'use strict';
import axios from "axios";
import db, { pool } from "../config/db.js";
import { checkIsManagerUrl } from "../utils.js/function.js";
import { deleteQuery, getSelectQuery, insertQuery, updateQuery } from "../utils.js/query-util.js";
import { checkDns, checkLevel, createHashedPassword, lowLevelException, response, settingFiles } from "../utils.js/util.js";
import 'dotenv/config';
import corpApi from "../utils.js/corp-util/index.js";

const table_name = 'brands';

const brandCtrl = {
    list: async (req, res, next) => {
        try {
            let is_manager = await checkIsManagerUrl(req);
            const decode_user = checkLevel(req.cookies.token, 0);
            const decode_dns = checkDns(req.cookies.dns);
            const { } = req.query;
            let columns = [
                `${table_name}.*`,
            ]
            let sql = `SELECT ${process.env.SELECT_COLUMN_SECRET} FROM ${table_name} `;
            if (decode_dns?.is_main_dns != 1) {
                sql += `WHERE id=${decode_dns?.id}`;
            }
            let data = await getSelectQuery(sql, columns, req.query);

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
            const decode_user = checkLevel(req.cookies.token, 0);
            const decode_dns = checkDns(req.cookies.dns);
            const { id } = req.params;
            let columns = [
                `${table_name}.*`,
                `virtual_accounts.guid`,
            ]
            let sql = `SELECT ${columns.join()} FROM ${table_name} `;
            sql += ` LEFT JOIN virtual_accounts ON ${table_name}.virtual_account_id=virtual_accounts.id `;
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
            const decode_user = checkLevel(req.cookies.token, 50);
            if (!decode_user) {
                return lowLevelException(req, res);
            }
            const decode_dns = checkDns(req.cookies.dns);
            const {
                name, dns, og_description, company_name, business_num, pvcy_rep_name, ceo_name, addr, addr_detail, resident_num, phone_num, fax_num, note, theme_css = {}, setting_obj = {}, level_obj = {}, bizppurio_obj = {},
                user_name, user_pw,
                deposit_corp_type, deposit_guid, deposit_api_id, deposit_sign_key, deposit_encr_key, deposit_iv,
                withdraw_corp_type, withdraw_guid, withdraw_api_id, withdraw_sign_key, withdraw_encr_key, withdraw_iv,
                default_deposit_fee, default_withdraw_fee, deposit_head_office_fee = 0, withdraw_head_office_fee = 0, default_withdraw_max_price = 0, withdraw_type = 0,
                is_use_telegram_bot = 0, telegram_bot_token = "", telegram_bot_id = "",
                is_use_deposit_operator = 1, is_use_withdraw_operator = 0,
            } = req.body;
            let files = settingFiles(req.files);
            let obj = {
                name, dns, og_description, company_name, business_num, pvcy_rep_name, ceo_name, addr, addr_detail, resident_num, phone_num, fax_num, note, theme_css, setting_obj, level_obj, bizppurio_obj,
                deposit_corp_type, deposit_guid, deposit_api_id, deposit_sign_key, deposit_encr_key, deposit_iv,
                withdraw_corp_type, withdraw_guid, withdraw_api_id, withdraw_sign_key, withdraw_encr_key, withdraw_iv,
                default_deposit_fee, default_withdraw_fee, deposit_head_office_fee, withdraw_head_office_fee, default_withdraw_max_price, withdraw_type,
                is_use_telegram_bot, telegram_bot_token, telegram_bot_id,
                is_use_deposit_operator, is_use_withdraw_operator,
            };
            obj['theme_css'] = JSON.stringify(obj.theme_css);
            obj['setting_obj'] = JSON.stringify(obj.setting_obj);
            obj['level_obj'] = JSON.stringify(obj.level_obj);
            obj['bizppurio_obj'] = JSON.stringify(obj.bizppurio_obj);

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
            const decode_user = checkLevel(req.cookies.token, 0);
            const decode_dns = checkDns(req.cookies.dns);
            const {
                name, dns, og_description, company_name, business_num, pvcy_rep_name, ceo_name, addr, addr_detail, resident_num, phone_num, fax_num, note, theme_css = {}, setting_obj = {}, level_obj = {}, bizppurio_obj = {},
                deposit_corp_type, deposit_guid, deposit_api_id, deposit_sign_key, deposit_encr_key, deposit_iv,
                withdraw_corp_type, withdraw_guid, withdraw_api_id, withdraw_sign_key, withdraw_encr_key, withdraw_iv,
                default_deposit_fee, default_withdraw_fee, deposit_head_office_fee = 0, withdraw_head_office_fee = 0, default_withdraw_max_price = 0,
                deposit_noti_url, withdraw_noti_url, withdraw_fail_noti_url, api_url, withdraw_type = 0, is_use_deposit_operator = 1, is_use_withdraw_operator = 0,
                is_use_telegram_bot = 0, telegram_bot_token = "", telegram_bot_id = "",
                guid = "",
            } = req.body;
            const { id } = req.params;
            if ((decode_user?.level < 50 && decode_user?.brand_id != id) || decode_user?.level < 40) {
                return lowLevelException(req, res);
            }
            let files = settingFiles(req.files);

            let obj = {
                name, dns, og_description, company_name, business_num, pvcy_rep_name, ceo_name, addr, addr_detail, resident_num, phone_num, fax_num, note, theme_css, setting_obj, level_obj, bizppurio_obj,
                deposit_corp_type, deposit_guid, deposit_api_id, deposit_sign_key, deposit_encr_key, deposit_iv,
                withdraw_corp_type, withdraw_guid, withdraw_api_id, withdraw_sign_key, withdraw_encr_key, withdraw_iv,
                default_deposit_fee, default_withdraw_fee, deposit_head_office_fee, withdraw_head_office_fee, default_withdraw_max_price, api_url, withdraw_type,
                is_use_telegram_bot, telegram_bot_token, telegram_bot_id,
                is_use_deposit_operator, is_use_withdraw_operator,
            };
            obj['theme_css'] = JSON.stringify(obj.theme_css);
            obj['setting_obj'] = JSON.stringify(obj.setting_obj);
            obj['level_obj'] = JSON.stringify(obj.level_obj);
            obj['bizppurio_obj'] = JSON.stringify(obj.bizppurio_obj);
            obj = { ...obj, ...files };

            await db.beginTransaction();



            let ago_brand = await pool.query(`SELECT * FROM ${table_name} WHERE id=${id}`);
            ago_brand = ago_brand?.result[0];

            if (guid) {
                let virtual_account = await pool.query(`SELECT * FROM virtual_accounts WHERE guid=? AND brand_id=${id}`, [guid]);
                virtual_account = virtual_account?.result[0];
                if (!virtual_account) {
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
            const decode_user = checkLevel(req.cookies.token, 0);
            const decode_dns = checkDns(req.cookies.dns);
            const { id } = req.params;
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
};

export default brandCtrl;
