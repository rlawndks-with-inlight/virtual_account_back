'use strict';
import axios from "axios";
import { readPool } from "../config/db-pool.js";
import { checkIsManagerUrl, returnMoment } from "../utils.js/function.js";
import { deleteQuery, getSelectQuery, insertQuery, selectQuerySimple, updateQuery } from "../utils.js/query-util.js";
import { checkDns, checkLevel, isItemBrandIdSameDnsId, lowLevelException, response, settingFiles } from "../utils.js/util.js";
import 'dotenv/config';

const table_name = 'bell_contents';

const bellContentCtrl = {
    list: async (req, res, next) => {
        try {
            let is_manager = await checkIsManagerUrl(req);
            const decode_user = await checkLevel(req.cookies.token, 10, req);
            const decode_dns = checkDns(req.cookies.dns);
            const { page, page_size } = req.query;
            if (!decode_user) {
                return lowLevelException(req, res);
            }
            let columns = [
                `${table_name}.*`,
            ]
            let sql = `SELECT ${columns.join()} FROM ${table_name} `;
            sql += ` WHERE ${table_name}.brand_id=${decode_dns?.id} `;
            if (decode_user?.level < 40) {
                sql += ` AND ${table_name}.user_id=${decode_user?.id} `;
                sql += ` AND ${table_name}.is_user_delete=0 `;
            } else {
                sql += ` AND ${table_name}.is_manager_delete=0 `;
            }
            sql += ` AND created_at >='${returnMoment(false, -3)}'`;
            sql += ` ORDER BY id DESC `;
            sql += ` LIMIT 0, 500 `;
            let bells = await readPool.query(sql);
            bells = bells[0];
            //let data = await getSelectQuery(sql, columns, req.query, [], decode_user, decode_dns);
            return response(req, res, 100, "success", {
                content: bells,
            });
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
            let data = await readPool.query(`SELECT * FROM ${table_name} WHERE id=${id}`)
            data = data[0][0];
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
            const decode_user = await checkLevel(req.cookies.token, 0, req);
            const decode_dns = checkDns(req.cookies.dns);
            const {
            } = req.body;
            let obj = {
                brand_id, name, note, price, category_id
            };



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
            const decode_user = await checkLevel(req.cookies.token, 0, req);
            const decode_dns = checkDns(req.cookies.dns);
            const {
                id
            } = req.body;
            let obj = {
            };


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
            const decode_user = await checkLevel(req.cookies.token, 10, req);
            const decode_dns = checkDns(req.cookies.dns);
            if (!decode_user) {
                return lowLevelException(req, res);
            }
            const { id } = req.params;
            let obj = {};
            if (decode_user?.level >= 40) {
                obj['is_manager_delete'] = 1;
            } else {
                obj['is_user_delete'] = 1;
            }
            let result = await updateQuery(`${table_name}`, obj, id);
            return response(req, res, 100, "success", {})
        } catch (err) {
            console.log(err)
            return response(req, res, -200, "서버 에러 발생", false)
        } finally {

        }
    },
    removeAll: async (req, res, next) => {
        try {
            let is_manager = await checkIsManagerUrl(req);
            const decode_user = await checkLevel(req.cookies.token, 10, req);
            const decode_dns = checkDns(req.cookies.dns);
            if (!decode_user) {
                return lowLevelException(req, res);
            }
            let obj = {};
            let id_column = '';
            let id = '';
            if (decode_user?.level >= 40) {
                obj['is_manager_delete'] = 1;
                id_column = 'brand_id';
                id = decode_dns?.id;
            } else {
                obj['is_user_delete'] = 1;
                id_column = 'user_id';
                id = decode_user?.id;
            }
            let result = await updateQuery(`${table_name}`, obj, id, id_column);
            return response(req, res, 100, "success", {})
        } catch (err) {
            console.log(err)
            return response(req, res, -200, "서버 에러 발생", false)
        } finally {

        }
    },
};

export default bellContentCtrl;
