'use strict';
import { pool } from "../config/db.js";
import corpApi from "../utils.js/corp-util/index.js";
import { checkIsManagerUrl } from "../utils.js/function.js";
import { deleteQuery, getSelectQuery, insertQuery, makeSearchQuery, selectQuerySimple, updateQuery } from "../utils.js/query-util.js";
import { checkDns, checkLevel, isItemBrandIdSameDnsId, lowLevelException, response, settingFiles } from "../utils.js/util.js";
import 'dotenv/config';

const table_name = 'black_lists';

const blackListCtrl = {
    list: async (req, res, next) => {
        try {
            let is_manager = await checkIsManagerUrl(req);
            const decode_user = await checkLevel(req.cookies.token, 10, req);
            const decode_dns = checkDns(req.cookies.dns);
            const { search } = req.query;
            if (!decode_user) {
                return lowLevelException(req, res);
            }
            let search_columns = [
                `mchts.user_name`,
                `mchts.nickname`,
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
            if (decode_user?.level < 40) {
                sql += ` AND ${table_name}.mcht_id=${decode_user?.id} `;
            }
            if (search) {
                sql += makeSearchQuery(search_columns, search);
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
            const decode_user = await checkLevel(req.cookies.token, 40, req);
            const decode_dns = checkDns(req.cookies.dns);
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
                brand_id,
                mcht_id,
                bank_code,
                acct_num,
                acct_name,
                phone_num,
            } = req.body;
            let files = settingFiles(req.files);
            if (
                !brand_id ||
                !mcht_id ||
                !bank_code ||
                !acct_num ||
                !acct_name ||
                !phone_num
            ) {
                return response(req, res, -100, "필수값을 입력해 주세요.", false)
            }
            let api_result = await corpApi.bl.create({
                pay_type: 'deposit',
                dns_data: decode_dns,
                decode_user,
                type: 0,
                word: acct_num,
            })
            if (api_result.code != 100) {
                return response(req, res, -100, (api_result?.message || "서버 에러 발생"), false)
            }
            let obj = {
                brand_id,
                mcht_id,
                bank_code,
                acct_num,
                acct_name,
                phone_num,
            };
            obj = { ...obj, ...files };

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
            const decode_user = await checkLevel(req.cookies.token, 40, req);
            const decode_dns = checkDns(req.cookies.dns);
            const { id } = req.params;

            let black_item = await selectQuerySimple(table_name, id);
            black_item = black_item?.result[0];
            if (!black_item || black_item?.brand_id != decode_dns?.id) {
                return response(req, res, -100, "잘못된 접근 입니다.", false)
            }
            let api_result = await corpApi.bl.remove({
                pay_type: 'deposit',
                dns_data: decode_dns,
                decode_user,
                type: black_item?.type,
                word: black_item?.acct_num,
            })
            if (api_result.code != 100) {
                return response(req, res, -100, (api_result?.message || "서버 에러 발생"), false)
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
};

export default blackListCtrl;
