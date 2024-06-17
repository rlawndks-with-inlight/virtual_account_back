'use strict';
import { pool } from "../config/db.js";
import { checkIsManagerUrl } from "../utils.js/function.js";
import { deleteQuery, getSelectQuery, insertQuery, selectQuerySimple, updateQuery } from "../utils.js/query-util.js";
import { checkDns, checkLevel, isItemBrandIdSameDnsId, response, settingFiles } from "../utils.js/util.js";
import 'dotenv/config';

const table_name = 'deposit_accounts';

const depositAccountCtrl = {
    list: async (req, res, next) => {
        try {
            let is_manager = await checkIsManagerUrl(req);
            const decode_user = await checkLevel(req.cookies.token, 10, req);
            const decode_dns = checkDns(req.cookies.dns);
            const { search, mcht_id } = req.query;
            if (!decode_user) {
                return lowLevelException(req, res);
            }
            let search_columns = [
                `mchts.user_name`,
                `mchts.nickname`,
                `${table_name}.acct_name`,
                `${table_name}.acct_num`,
            ]
            let columns = [
                `mchts.user_name`,
                `mchts.nickname`,
                `${table_name}.*`,
            ]
            let sql = `SELECT ${process.env.SELECT_COLUMN_SECRET} FROM ${table_name} `;
            sql += ` LEFT JOIN users AS mchts ON ${table_name}.mcht_id=mchts.id `;
            sql += ` WHERE ${table_name}.brand_id=${decode_dns?.id} `;
            if (search) {
                sql += makeSearchQuery(search_columns, search);
            }
            if (mcht_id > 0 || decode_user?.level == 10) {
                sql += ` AND ${table_name}.mcht_id=${mcht_id || decode_user?.id} `;
            }
            let data = await getSelectQuery(sql, columns, req.query, [], decode_user, decode_dns);

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
            const decode_user = await checkLevel(req.cookies.token, 10, req);
            const decode_dns = checkDns(req.cookies.dns);
            if (!decode_user) {
                return lowLevelException(req, res);
            }
            const { id } = req.params;
            let data = await pool.query(`SELECT * FROM ${table_name} WHERE id=${id}`)
            data = data?.result[0];
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
    create: async (req, res, next) => {
        try {
            let is_manager = await checkIsManagerUrl(req);
            const decode_user = await checkLevel(req.cookies.token, 10, req);
            const decode_dns = checkDns(req.cookies.dns);
            if (!decode_user) {
                return lowLevelException(req, res);
            }
            const {
                brand_id, bank_code, acct_num, acct_name, mcht_id
            } = req.body;
            let obj = {
                brand_id, bank_code, acct_num, acct_name, mcht_id
            };
            let result_mcht_id = mcht_id;
            if (decode_user?.level >= 40) {

            } else if (decode_user?.level == 10) {
                result_mcht_id = decode_user?.id;
            } else {
                return lowLevelException(req, res);
            }
            let is_exist_another_mcht = await pool.query(`SELECT * FROM ${table_name} WHERE is_delete=0 AND mcht_id!=${result_mcht_id} AND acct_name=? AND brand_id=${decode_dns?.id}`, [
                acct_name
            ]);
            if (is_exist_another_mcht?.result.length > 0) {
                return response(req, res, -100, "본사에 문의해 주세요.", false)
            }
            obj['mcht_id'] = result_mcht_id;
            let result = await insertQuery(`${table_name}`, obj);

            return response(req, res, 100, "success", {})
        } catch (err) {
            console.log(err)
            return response(req, res, -200, "서버 에러 발생", false)
        } finally {

        }
    },
    update: async (req, res, next) => {
        try {
            let is_manager = await checkIsManagerUrl(req);
            const decode_user = await checkLevel(req.cookies.token, 10, req);
            const decode_dns = checkDns(req.cookies.dns);
            if (!decode_user) {
                return lowLevelException(req, res);
            }
            const {
                id, brand_id, bank_code, acct_num, acct_name, mcht_id
            } = req.body;
            let files = settingFiles(req.files);
            let obj = {
                brand_id, bank_code, acct_num, acct_name, mcht_id
            };
            let result_mcht_id = mcht_id;
            if (decode_user?.level >= 40) {

            } else if (decode_user?.level == 10) {
                result_mcht_id = decode_user?.id;
            } else {
                return lowLevelException(req, res);
            }
            let is_exist_another_mcht = await pool.query(`SELECT * FROM ${table_name} WHERE is_delete=0 AND mcht_id!=${result_mcht_id} AND acct_name=? AND brand_id=${decode_dns?.id}`, [
                acct_name
            ]);
            if (is_exist_another_mcht?.result.length > 0) {
                return response(req, res, -100, "본사에 문의해 주세요.", false)
            }
            obj['mcht_id'] = result_mcht_id;
            let result = await updateQuery(`${table_name}`, obj, id);

            return response(req, res, 100, "success", {})
        } catch (err) {
            console.log(err)
            return response(req, res, -200, "서버 에러 발생", false)
        } finally {

        }
    },
    remove: async (req, res, next) => {
        try {
            let is_manager = await checkIsManagerUrl(req);
            const decode_user = await checkLevel(req.cookies.token, 0, req);
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

export default depositAccountCtrl;
