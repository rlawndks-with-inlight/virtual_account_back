'use strict';
import axios from "axios";
import db, { pool } from "../config/db.js";
import { checkIsManagerUrl } from "../utils.js/function.js";
import { deleteQuery, getSelectQuery, insertQuery, updateQuery } from "../utils.js/query-util.js";
import { checkDns, checkLevel, createHashedPassword, generateRandomString, getMotherDeposit, lowLevelException, response, settingFiles } from "../utils.js/util.js";
import 'dotenv/config';
import corpApi from "../utils.js/corp-util/index.js";
import speakeasy from 'speakeasy';
const table_name = 'brands';

const brandCtrl = {
    list: async (req, res, next) => {
        try {
            let is_manager = await checkIsManagerUrl(req);
            const decode_user = await checkLevel(req.cookies.token, 40, req);
            const decode_dns = checkDns(req.cookies.dns);
            const { } = req.query;
            if (!decode_user) {
                return lowLevelException(req, res);
            }
            let columns = [
                `${table_name}.*`,
                `(SELECT MAX(date) FROM brand_pays WHERE brand_id=${table_name}.id AND is_delete=0) AS last_pay_date`
            ]
            let sql = `SELECT ${process.env.SELECT_COLUMN_SECRET} FROM ${table_name} `;
            sql += ` WHERE is_delete=0 `
            if (decode_dns?.is_main_dns != 1) {
                sql += ` AND id=${decode_dns?.id}`;
            }

            let chart_columns = [
                `SUM(${table_name}.pay_amount) AS pay_amount`,
            ]
            let chart_sql = sql;
            chart_sql = chart_sql.replaceAll(process.env.SELECT_COLUMN_SECRET, chart_columns.join());

            let data = await getSelectQuery(sql, columns, req.query, [{
                table: 'chart',
                sql: chart_sql,
            }], decode_user, decode_dns);
            data.chart = data?.chart[0] ?? {};

            return response(req, res, 100, "success", data);
        } catch (err) {
            console.log(err)
            return response(req, res, -200, "서버 에러 발생", false)
        } finally {

        }
    },
    get: async (req, res, next) => {
        try {
            let is_manager = await checkIsManagerUrl(req);
            const decode_user = await checkLevel(req.cookies.token, 40, req);
            const decode_dns = checkDns(req.cookies.dns);
            if (!decode_user) {
                return lowLevelException(req, res);
            }
            const { id } = req.params;
            let columns = [
                `${table_name}.*`,
                `virtual_accounts.guid`,
                `parent_brands.dns AS parent_dns`,
            ]
            let sql = `SELECT ${columns.join()} FROM ${table_name} `;
            sql += ` LEFT JOIN virtual_accounts ON ${table_name}.virtual_account_id=virtual_accounts.id `;
            sql += ` LEFT JOIN brands AS parent_brands ON ${table_name}.parent_id=parent_brands.id `;
            sql += ` WHERE ${table_name}.id=${id} `;
            let data = await pool.query(sql)
            data = data?.result[0];
            data['theme_css'] = JSON.parse(data?.theme_css ?? '{}');
            data['setting_obj'] = JSON.parse(data?.setting_obj ?? '{}');
            data['level_obj'] = JSON.parse(data?.level_obj ?? '{}');
            data['bizppurio_obj'] = JSON.parse(data?.bizppurio_obj ?? '{}');
            return response(req, res, 100, "success", data)
        } catch (err) {
            console.log(err)
            return response(req, res, -200, "서버 에러 발생", false)
        } finally {

        }
    },
    create: async (req, res, next) => { // 50레벨이상 관리자 url만
        try {
            let is_manager = await checkIsManagerUrl(req);
            const decode_user = await checkLevel(req.cookies.token, 50);
            if (!decode_user) {
                return lowLevelException(req, res);
            }
            const decode_dns = checkDns(req.cookies.dns);
            const {
                name, dns, parent_dns, og_description, company_name, business_num, pvcy_rep_name, ceo_name, addr, addr_detail, resident_num, phone_num, fax_num, pay_day, pay_amount = 0, note, theme_css = {}, setting_obj = {}, level_obj = {}, bizppurio_obj = {},
                user_name, user_pw,
                deposit_corp_type, deposit_guid, deposit_api_id, deposit_sign_key, deposit_encr_key, deposit_iv,
                auth_mcht_id, auth_corp_type, auth_api_id, auth_iv, auth_fee = 0,
                withdraw_corp_type, withdraw_guid, withdraw_api_id, withdraw_sign_key, withdraw_encr_key, withdraw_iv, deposit_virtual_bank_code, withdraw_virtual_bank_code, withdraw_virtual_acct_num, withdraw_trt_inst_code,
                default_deposit_fee, default_withdraw_fee, head_office_fee = 0, deposit_head_office_fee = 0, withdraw_head_office_fee = 0, default_withdraw_max_price = 0, withdraw_type = 0, withdraw_fee_type = 0,
                is_use_telegram_bot = 0, telegram_bot_token = "", telegram_bot_id = "", is_use_otp = 0, otp_token = "", is_use_sign_key = 0,
                is_use_fee_operator = 1, is_use_deposit_operator = 0, is_use_withdraw_operator = 0, hold_amount = 0,
                is_use_corp_account = 0, corp_account_corp_type = 0, is_can_add_deposit = 0, is_use_asapmall_noti = 0, asapmall_dns = "", asapmall_back_dns = "", is_use_destruct_auto_virtual_acct = 0, destruct_auto_virtual_acct_minute = 0,
            } = req.body;
            let files = settingFiles(req.files);
            let obj = {
                name, dns, og_description, company_name, business_num, pvcy_rep_name, ceo_name, addr, addr_detail, resident_num, phone_num, fax_num, pay_day, pay_amount, note, theme_css, setting_obj, level_obj, bizppurio_obj,
                deposit_corp_type, deposit_guid, deposit_api_id, deposit_sign_key, deposit_encr_key, deposit_iv,
                auth_mcht_id, auth_corp_type, auth_api_id, auth_iv, auth_fee,
                withdraw_corp_type, withdraw_guid, withdraw_api_id, withdraw_sign_key, withdraw_encr_key, withdraw_iv, deposit_virtual_bank_code, withdraw_virtual_bank_code, withdraw_virtual_acct_num, withdraw_trt_inst_code,
                default_deposit_fee, default_withdraw_fee, head_office_fee, deposit_head_office_fee, withdraw_head_office_fee, default_withdraw_max_price, withdraw_type, withdraw_fee_type,
                is_use_telegram_bot, telegram_bot_token, telegram_bot_id, is_use_otp, otp_token, is_use_sign_key,
                is_use_fee_operator, is_use_deposit_operator, is_use_withdraw_operator, hold_amount,
                is_use_corp_account, corp_account_corp_type, is_can_add_deposit, is_use_asapmall_noti, asapmall_dns, asapmall_back_dns, is_use_destruct_auto_virtual_acct, destruct_auto_virtual_acct_minute,
            };
            obj['theme_css'] = JSON.stringify(obj.theme_css);
            obj['setting_obj'] = JSON.stringify(obj.setting_obj);
            obj['level_obj'] = JSON.stringify(obj.level_obj);
            obj['bizppurio_obj'] = JSON.stringify(obj.bizppurio_obj);
            if (parent_dns) {
                let parent_dns_data = await pool.query(`SELECT * FROM brands WHERE dns=?`, [parent_dns]);
                parent_dns_data = (parent_dns_data?.result[0] ?? {});
                obj['parent_id'] = parent_dns_data?.id ?? 0;
            }
            let api_key = await createHashedPassword('dns');
            api_key = api_key.hashedPassword.substring(0, 40);
            obj['api_key'] = api_key;


            obj = { ...obj, ...files };
            await db.beginTransaction();

            let result = await insertQuery(`${table_name}`, obj);
            let user_obj = {
                user_name: user_name,
                user_pw: user_pw,
                name: name,
                nickname: name,
                level: 40,
                brand_id: result?.result?.insertId
            }
            let pw_data = await createHashedPassword(user_obj.user_pw);
            user_obj.user_pw = pw_data.hashedPassword;
            let user_salt = pw_data.salt;
            user_obj['user_salt'] = user_salt;
            let user_sign_up = await insertQuery('users', user_obj);

            await db.commit();
            return response(req, res, 100, "success", {})
        } catch (err) {
            console.log(err)
            await db.rollback();
            return response(req, res, -200, "서버 에러 발생", false)
        }
    },
    update: async (req, res, next) => { // 40레벨일시 자기 브랜드 수정, 50레벨일시 모든 브랜드 수정가능
        try {
            let is_manager = await checkIsManagerUrl(req);
            const decode_user = await checkLevel(req.cookies.token, 0, req);
            const decode_dns = checkDns(req.cookies.dns);
            const {
                name, dns, parent_dns, og_description, company_name, business_num, pvcy_rep_name, ceo_name, addr, addr_detail, resident_num, phone_num, fax_num, pay_day, pay_amount = 0, note, theme_css = {}, setting_obj = {}, level_obj = {}, bizppurio_obj = {},
                deposit_corp_type, deposit_guid, deposit_api_id, deposit_sign_key, deposit_encr_key, deposit_iv,
                auth_mcht_id, auth_corp_type, auth_api_id, auth_iv, auth_fee = 0,
                withdraw_corp_type, withdraw_guid, withdraw_api_id, withdraw_sign_key, withdraw_encr_key, withdraw_iv, deposit_virtual_bank_code, withdraw_virtual_bank_code, withdraw_virtual_acct_num, withdraw_trt_inst_code,
                default_deposit_fee, default_withdraw_fee, head_office_fee = 0, deposit_head_office_fee = 0, withdraw_head_office_fee = 0, default_withdraw_max_price = 0,
                deposit_noti_url, withdraw_noti_url, withdraw_fail_noti_url, api_url, withdraw_type = 0, withdraw_fee_type = 0,
                is_use_telegram_bot = 0, telegram_bot_token = "", telegram_bot_id = "", is_use_otp = 0, otp_token = "", is_use_sign_key = 0,
                is_use_fee_operator = 1, is_use_deposit_operator = 0, is_use_withdraw_operator = 0, hold_amount = 0,
                is_use_corp_account = 0, corp_account_corp_type = 0, is_can_add_deposit = 0, is_use_asapmall_noti = 0, asapmall_dns = "", asapmall_back_dns = "", is_use_destruct_auto_virtual_acct = 0, destruct_auto_virtual_acct_minute = 0,
                guid = "",
            } = req.body;
            const { id } = req.params;
            if ((decode_user?.level < 45 && decode_user?.brand_id != id) || decode_user?.level < 40) {
                return lowLevelException(req, res);
            }
            let files = settingFiles(req.files);

            let obj = {
                name, dns, og_description, company_name, business_num, pvcy_rep_name, ceo_name, addr, addr_detail, resident_num, phone_num, fax_num, pay_day, pay_amount, note, theme_css, setting_obj, level_obj, bizppurio_obj,
                deposit_corp_type, deposit_guid, deposit_api_id, deposit_sign_key, deposit_encr_key, deposit_iv,
                auth_mcht_id, auth_corp_type, auth_api_id, auth_iv, auth_fee,
                withdraw_corp_type, withdraw_guid, withdraw_api_id, withdraw_sign_key, withdraw_encr_key, withdraw_iv, deposit_virtual_bank_code, withdraw_virtual_bank_code, withdraw_virtual_acct_num, withdraw_trt_inst_code,
                default_deposit_fee, default_withdraw_fee, head_office_fee, deposit_head_office_fee, withdraw_head_office_fee, default_withdraw_max_price, api_url, withdraw_type, withdraw_fee_type,
                is_use_telegram_bot, telegram_bot_token, telegram_bot_id, is_use_otp, otp_token, is_use_sign_key,
                is_use_fee_operator, is_use_deposit_operator, is_use_withdraw_operator, hold_amount,
                is_use_corp_account, corp_account_corp_type, is_can_add_deposit, is_use_asapmall_noti, asapmall_dns, asapmall_back_dns, is_use_destruct_auto_virtual_acct, destruct_auto_virtual_acct_minute,
            };
            obj['theme_css'] = JSON.stringify(obj.theme_css);
            obj['setting_obj'] = JSON.stringify(obj.setting_obj);
            obj['level_obj'] = JSON.stringify(obj.level_obj);
            obj['bizppurio_obj'] = JSON.stringify(obj.bizppurio_obj);
            obj = { ...obj, ...files };
            if (parent_dns) {
                let parent_dns_data = await pool.query(`SELECT * FROM brands WHERE dns=?`, [parent_dns]);
                parent_dns_data = (parent_dns_data?.result[0] ?? {});
                obj['parent_id'] = parent_dns_data?.id ?? 0;
            }
            await db.beginTransaction();



            let ago_brand = await pool.query(`SELECT * FROM ${table_name} WHERE id=${id}`);
            ago_brand = ago_brand?.result[0];

            if (guid) {
                let virtual_account = await pool.query(`SELECT * FROM virtual_accounts WHERE guid=? AND brand_id=${id}`, [guid]);
                virtual_account = virtual_account?.result[0];
                if (!virtual_account) {
                    await db.rollback();
                    return response(req, res, -100, "가상계좌가 존재하지 않습니다.", false)
                }
                obj['virtual_account_id'] = virtual_account?.id;
            } else {
                obj['virtual_account_id'] = 0;
            }

            if (deposit_noti_url != ago_brand?.deposit_noti_url && deposit_noti_url) {
                let api_result = await corpApi.push[(ago_brand?.deposit_noti_url) ? 'update' : 'create']({
                    pay_type: 'deposit',
                    dns_data: ago_brand,
                    decode_user,
                    push_kind: 'DEPOSIT',
                    push_tp: 'JSON',
                    push_url: deposit_noti_url,
                    encr_yn: 'N',
                })
                console.log(api_result)
                if (api_result.code == 100) {
                    obj['deposit_noti_url'] = deposit_noti_url;
                }
            }
            if (withdraw_noti_url != ago_brand?.withdraw_noti_url && withdraw_noti_url) {
                let api_result = await corpApi.push[(ago_brand?.withdraw_noti_url) ? 'update' : 'create']({
                    pay_type: 'withdraw',
                    dns_data: ago_brand,
                    decode_user,
                    push_kind: 'WITHDRAW',
                    push_tp: 'JSON',
                    push_url: withdraw_noti_url,
                    encr_yn: 'N',
                })
                console.log(api_result)
                if (api_result.code == 100) {
                    obj['withdraw_noti_url'] = withdraw_noti_url;
                }
            }
            if (withdraw_fail_noti_url != ago_brand?.withdraw_fail_noti_url && withdraw_fail_noti_url) {
                let api_result = await corpApi.push[(ago_brand?.withdraw_fail_noti_url) ? 'update' : 'create']({
                    pay_type: 'withdraw',
                    dns_data: ago_brand,
                    decode_user,
                    push_kind: 'WITHDRAW_FAIL',
                    push_tp: 'JSON',
                    push_url: withdraw_fail_noti_url,
                    encr_yn: 'N',
                })
                console.log(api_result)
                if (api_result.code == 100) {
                    obj['withdraw_fail_noti_url'] = withdraw_fail_noti_url;
                }
            }
            let result = await updateQuery(`${table_name}`, obj, id);

            await db.commit();
            return response(req, res, 100, "success", {})
        } catch (err) {
            console.log(err)
            await db.rollback();
            return response(req, res, -200, "서버 에러 발생", false)
        } finally {

        }
    },
    remove: async (req, res, next) => {
        try {
            let is_manager = await checkIsManagerUrl(req);
            const decode_user = await checkLevel(req.cookies.token, 50);
            const decode_dns = checkDns(req.cookies.dns);
            const { id } = req.params;
            if (!decode_user) {
                return lowLevelException(req, res);
            }
            let result = await deleteQuery(`${table_name}`, {
                id
            })
            return response(req, res, 100, "success", {})
        } catch (err) {
            console.log(err)
            return response(req, res, -200, "서버 에러 발생", false)
        } finally {

        }
    },
    settingOtp: async (req, res, next) => {
        try {
            const decode_user = await checkLevel(req.cookies.token, 0, req);
            const decode_dns = checkDns(req.cookies.dns);
            const { brand_id } = req.body;
            let dns_data = await pool.query(`SELECT ${table_name}.* FROM ${table_name} WHERE id=${brand_id}`);
            dns_data = dns_data?.result[0];
            const secret = speakeasy.generateSecret({
                length: 20, // 비밀키의 길이를 설정 (20자리)
                name: dns_data?.dns, // 사용자 아이디를 비밀키의 이름으로 설정
                algorithm: 'sha512' // 해시 알고리즘 지정 (SHA-512 사용)
            })
            return response(req, res, 100, "success", secret)
        } catch (err) {
            console.log(err)
            return response(req, res, -200, "서버 에러 발생", false)
        } finally {

        }
    },
    settingSignKey: async (req, res, next) => {
        try {
            const decode_user = await checkLevel(req.cookies.token, 0, req);
            const decode_dns = checkDns(req.cookies.dns);
            const { brand_id } = req.body;
            let dns_data = await pool.query(`SELECT ${table_name}.* FROM ${table_name} WHERE id=${brand_id}`);
            dns_data = dns_data?.result[0];
            let rand_text = generateRandomString(30);
            return response(req, res, 100, "success", {
                rand_text
            })
        } catch (err) {
            console.log(err)
            return response(req, res, -200, "서버 에러 발생", false)
        } finally {

        }
    },
    changeMotherDeposit: async (req, res, next) => {
        try {
            const decode_user = await checkLevel(req.cookies.token, 40, req);
            const decode_dns = checkDns(req.cookies.dns);
            const { brand_id, pay_type, amount, note } = req.body;
            let obj = {
                brand_id, pay_type, amount, note
            }
            if (!decode_user) {
                return lowLevelException(req, res);
            }
            await db.beginTransaction();
            let result = await insertQuery(`deposits`, obj);

            let data = await getMotherDeposit(decode_dns);
            if (data?.real_amount < 0) {
                await db.rollback();
                return response(req, res, -200, "모계좌 잔액은 마이너스가 될 수 없습니다.", false)
            }
            await db.commit();
            return response(req, res, 100, "success", {})
        } catch (err) {
            console.log(err)
            await db.rollback();
            return response(req, res, -200, "서버 에러 발생", false)
        } finally {

        }
    },
};

export default brandCtrl;
