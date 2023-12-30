'use strict';
import _ from "lodash";
import db, { pool } from "../config/db.js";
import { checkIsManagerUrl } from "../utils.js/function.js";
import { deleteQuery, getSelectQuery, insertQuery, selectQuerySimple, updateQuery } from "../utils.js/query-util.js";
import { checkDns, checkLevel, createHashedPassword, isItemBrandIdSameDnsId, lowLevelException, makeObjByList, makeUserChildrenList, makeUserTree, operatorLevelList, response, settingFiles } from "../utils.js/util.js";
import 'dotenv/config';
import corpApi from "../utils.js/corp-util/index.js";
import axios from "axios";

const table_name = 'users';

const userCtrl = {
    list: async (req, res, next) => {
        try {
            let is_manager = await checkIsManagerUrl(req);
            const decode_user = checkLevel(req.cookies.token, 0);
            const decode_dns = checkDns(req.cookies.dns);
            const { level, level_list = [] } = req.query;
            let columns = [
                `${table_name}.*`,
                `merchandise_columns.mcht_fee`,
            ]
            let sql = `SELECT ${process.env.SELECT_COLUMN_SECRET} FROM ${table_name} `;
            sql += ` LEFT JOIN merchandise_columns ON merchandise_columns.mcht_id=${table_name}.id `;

            for (var i = 0; i < decode_dns?.operator_list.length; i++) {
                columns.push(`merchandise_columns.sales${decode_dns?.operator_list[i]?.num}_id`);
                columns.push(`merchandise_columns.sales${decode_dns?.operator_list[i]?.num}_fee`);
                columns.push(`sales${decode_dns?.operator_list[i]?.num}.user_name AS sales${decode_dns?.operator_list[i]?.num}_user_name`);
                columns.push(`sales${decode_dns?.operator_list[i]?.num}.nickname AS sales${decode_dns?.operator_list[i]?.num}_nickname`);
                sql += ` LEFT JOIN users AS sales${decode_dns?.operator_list[i]?.num} ON sales${decode_dns?.operator_list[i]?.num}.id=merchandise_columns.sales${decode_dns?.operator_list[i]?.num}_id `;
            }
            sql += ` WHERE ${table_name}.brand_id=${decode_dns?.id} `;
            sql += ` AND ${table_name}.level <= ${decode_user?.level} `;

            if (level) {
                let find_oper_level = _.find(operatorLevelList, { level: parseInt(level) });
                if (level == 10) {
                    columns.push(`(SELECT SUM(mcht_amount) FROM deposits WHERE mcht_id=${table_name}.id) AS settle_amount`)
                } else if (find_oper_level) {
                    columns.push(`(SELECT SUM(sales${find_oper_level.num}_amount) FROM deposits WHERE sales${find_oper_level.num}_id=${table_name}.id) AS settle_amount`)
                }
                sql += ` AND ${table_name}.level = ${level} `;
            }

            if (level_list.length > 0) {
                sql += ` AND ${table_name}.level IN (${level_list}) `;
            }
            let data = await getSelectQuery(sql, columns, req.query);

            return response(req, res, 100, "success", data);

        } catch (err) {
            console.log(err)
            return response(req, res, -200, "서버 에러 발생", false)
        } finally {

        }
    },
    organizationalChart: async (req, res, next) => {
        try {
            let is_manager = await checkIsManagerUrl(req);
            const decode_user = checkLevel(req.cookies.token, 0);
            const decode_dns = checkDns(req.cookies.dns);

            let user_list = await pool.query(`SELECT * FROM ${table_name} WHERE ${table_name}.brand_id=${decode_dns?.id} AND ${table_name}.is_delete=0 `);
            let user_tree = makeUserTree(user_list?.result, decode_user);
            return response(req, res, 100, "success", user_tree);
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
                `merchandise_columns.mcht_fee`,
            ]
            for (var i = 0; i < decode_dns?.operator_list.length; i++) {
                columns.push(`merchandise_columns.sales${decode_dns?.operator_list[i]?.num}_id`);
                columns.push(`merchandise_columns.sales${decode_dns?.operator_list[i]?.num}_fee`);
            }
            let sql = `SELECT ${columns.join()} FROM ${table_name} `;
            sql += ` LEFT JOIN merchandise_columns ON merchandise_columns.mcht_id=${table_name}.id `;
            sql += ` WHERE ${table_name}.id=${id} `;

            let data = await pool.query(sql)
            data = data?.result[0];
            let api_result = await corpApi.balance.info({
                pay_type: 'deposit',
                dns_data: decode_dns,
                decode_user,
                guid: data?.guid
            })
            if (!isItemBrandIdSameDnsId(decode_dns, data)) {
                return lowLevelException(req, res);
            }
            return response(req, res, 100, "success", data)
        } catch (err) {
            console.log(err)
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
    create: async (req, res, next) => {
        try {
            let is_manager = await checkIsManagerUrl(req);
            const decode_user = checkLevel(req.cookies.token, 0);
            const decode_dns = checkDns(req.cookies.dns);
            let {
                brand_id, user_name, user_pw, name, nickname, level, phone_num, profile_img, note, email, birth,
                mcht_fee = 0,
                settle_bank_code = "", settle_acct_num = "", settle_acct_name = "", deposit_fee = 0, withdraw_fee = 0, min_withdraw_price = 0, min_withdraw_remain_price = 0,
            } = req.body;
            let is_exist_user = await pool.query(`SELECT * FROM ${table_name} WHERE user_name=? AND brand_id=${brand_id}`, [user_name]);
            if (is_exist_user?.result.length > 0) {
                return response(req, res, -100, "유저아이디가 이미 존재합니다.", false)
            }

            let pw_data = await createHashedPassword(user_pw);
            user_pw = pw_data.hashedPassword;
            let user_salt = pw_data.salt;
            let files = settingFiles(req.files);
            let obj = {
                brand_id, user_name, user_pw, user_salt, name, nickname, level, phone_num, profile_img, note, email, birth,
                settle_bank_code, settle_acct_num, settle_acct_name, deposit_fee, withdraw_fee, min_withdraw_price, min_withdraw_remain_price,
            };
            obj = { ...obj, ...files };
            await db.beginTransaction();
            let api_result = await corpApi.user.create({
                pay_type: 'deposit',
                dns_data: decode_dns,
                decode_user,
                email,
                name,
                phone_num,
                birth
            })
            console.log(api_result)
            if (api_result.code != 100) {
                return response(req, res, -100, (api_result?.message || "서버 에러 발생"), api_result?.data)
            }
            obj['guid'] = api_result.data?.guid
            console.log(api_result)
            let result = await insertQuery(`${table_name}`, obj);
            let user_id = result?.result?.insertId;
            let result2 = await updateQuery(table_name, {
                mid: `${new Date().getTime()}${decode_dns?.id}${user_id}`,
            }, user_id)
            if (level == 10) {//가맹점
                let mcht_obj = {
                    mcht_id: result?.result?.insertId,
                    mcht_fee,
                };
                for (var i = 0; i < decode_dns?.operator_list.length; i++) {
                    if (req.body[`sales${decode_dns?.operator_list[i]?.num}_id`]) {
                        mcht_obj[`sales${decode_dns?.operator_list[i]?.num}_id`] = req.body[`sales${decode_dns?.operator_list[i]?.num}_id`];
                        mcht_obj[`sales${decode_dns?.operator_list[i]?.num}_fee`] = req.body[`sales${decode_dns?.operator_list[i]?.num}_fee`];
                    }
                }
                let mcht_result = await insertQuery(`merchandise_columns`, mcht_obj);
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
    update: async (req, res, next) => {
        try {
            let is_manager = await checkIsManagerUrl(req);
            const decode_user = checkLevel(req.cookies.token, 0);
            const decode_dns = checkDns(req.cookies.dns);
            const {
                brand_id, user_name, name, nickname, level, phone_num, profile_img, note, email, birth,
                mcht_fee = 0,
                settle_bank_code = "", settle_acct_num = "", settle_acct_name = "", deposit_fee = 0, withdraw_fee = 0, min_withdraw_price = 0, min_withdraw_remain_price = 0,
                vrf_word,
                id
            } = req.body;
            let files = settingFiles(req.files);
            let obj = {
                brand_id, user_name, name, nickname, level, phone_num, profile_img, note, email, birth,
                settle_bank_code, settle_acct_num, settle_acct_name, deposit_fee, withdraw_fee, min_withdraw_price, min_withdraw_remain_price,
            };
            obj = { ...obj, ...files };
            await db.beginTransaction();
            let ago_user = await pool.query(`SELECT * FROM users WHERE id=${id}`);
            ago_user = ago_user?.result[0];

            let is_change_settle_bank = (settle_bank_code != ago_user?.settle_bank_code || settle_acct_num != ago_user?.settle_acct_num || settle_acct_name != ago_user?.settle_acct_name) && (settle_bank_code || settle_acct_num || settle_acct_name);
            if (is_change_settle_bank && !vrf_word) {
                return response(req, res, -200, "정산계좌 변경시 1원인증을 진행해주세요.", false)
            }
            if (is_change_settle_bank && vrf_word) {
                let api_result = await corpApi.user.account_verify({
                    pay_type: 'deposit',
                    dns_data: decode_dns,
                    decode_user,
                    ...req.body,
                })
                if (api_result.code != 100) {
                    return response(req, res, -100, (api_result?.message || "서버 에러 발생"), false)
                }
                let issued_api_result = await corpApi.vaccount({
                    pay_type: 'deposit',
                    decode_dns,
                    decode_user: ago_user,
                    guid: ago_user?.guid,
                })
                if (issued_api_result.code != 100) {
                    return response(req, res, -100, (issued_api_result?.message || "서버 에러 발생"), false)
                }
            }
            let result = await updateQuery(`${table_name}`, obj, id);
            if (level == 10) {//가맹점
                let mcht_obj = {
                    mcht_fee,
                };
                for (var i = 0; i < decode_dns?.operator_list.length; i++) {
                    mcht_obj[`sales${decode_dns?.operator_list[i]?.num}_id`] = req.body[`sales${decode_dns?.operator_list[i]?.num}_id`] || 0;
                    mcht_obj[`sales${decode_dns?.operator_list[i]?.num}_fee`] = req.body[`sales${decode_dns?.operator_list[i]?.num}_fee`] || 0;
                }
                let mcht_result = await updateQuery(`merchandise_columns`, mcht_obj, id, 'mcht_id');
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
    changePassword: async (req, res, next) => {
        try {
            let is_manager = await checkIsManagerUrl(req);
            const decode_user = checkLevel(req.cookies.token, 0);
            const decode_dns = checkDns(req.cookies.dns);
            const { id } = req.params
            let { user_pw } = req.body;

            let user = await selectQuerySimple(table_name, id);
            user = user?.result[0];
            if (!user || decode_user?.level < user?.level) {
                return response(req, res, -100, "잘못된 접근입니다.", false)
            }
            let pw_data = await createHashedPassword(user_pw);
            user_pw = pw_data.hashedPassword;
            let user_salt = pw_data.salt;
            let obj = {
                user_pw, user_salt
            }
            let result = await updateQuery(`${table_name}`, obj, id);
            return response(req, res, 100, "success", {})
        } catch (err) {
            console.log(err)
            return response(req, res, -200, "서버 에러 발생", false)
        } finally {

        }
    },
    changeStatus: async (req, res, next) => {
        try {
            let is_manager = await checkIsManagerUrl(req);
            const decode_user = checkLevel(req.cookies.token, 0);
            const decode_dns = checkDns(req.cookies.dns);
            const { id } = req.params
            let { status } = req.body;
            let user = await selectQuerySimple(table_name, id);
            console.log(status)
            user = user?.result[0];
            if (!user || decode_user?.level < user?.level) {
                return response(req, res, -100, "잘못된 접근입니다.", false)
            }
            let obj = {
                status
            }
            let result = await updateQuery(`${table_name}`, obj, id);
            return response(req, res, 100, "success", {})
        } catch (err) {
            console.log(err)
            return response(req, res, -200, "서버 에러 발생", false)
        } finally {

        }
    },
    oneWonCertification: async (req, res, next) => {
        try {
            let is_manager = await checkIsManagerUrl(req);
            const decode_user = checkLevel(req.cookies.token, 0);
            const decode_dns = checkDns(req.cookies.dns);
            let { birth, settle_bank_code, settle_acct_num, settle_acct_name, guid } = req.body;

            let result = await corpApi.user.account({
                pay_type: 'deposit',
                dns_data: decode_dns,
                decode_user: decode_user,
                settle_bank_code,
                settle_acct_num,
                settle_acct_name,
                guid,
                birth,
            })
            if (result.code != 100) {
                return response(req, res, -100, (result?.message || "서버 에러 발생"), result?.data)
            }

            return response(req, res, 100, "success", result?.data)


        } catch (err) {
            console.log(err)
            return response(req, res, -200, "서버 에러 발생", false)
        } finally {

        }
    },
    oneWonCertificationCheck: async (req, res, next) => {
        try {
            let is_manager = await checkIsManagerUrl(req);
            const decode_user = checkLevel(req.cookies.token, 0);
            const decode_dns = checkDns(req.cookies.dns);
            let { tid, vrf_word } = req.body;
            let result = await corpApi.user.account_verify({
                pay_type: 'deposit',
                dns_data: decode_dns,
                decode_user: decode_user,
                tid,
                vrf_word
            })
            if (result.code != 100) {
                return response(req, res, -100, (result?.message || "서버 에러 발생"), {})
            }
            return response(req, res, 100, "success", result.data)
        } catch (err) {
            console.log(err)
            return response(req, res, -200, "서버 에러 발생", false)
        } finally {

        }
    },
}
export default userCtrl;
