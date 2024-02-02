'use strict';
import { pool } from "../config/db.js";
import { checkIsManagerUrl } from "../utils.js/function.js";
import { deleteQuery, getSelectQuery, insertQuery, selectQuerySimple, updateQuery } from "../utils.js/query-util.js";
import { checkDns, checkLevel, getNumberByPercent, isItemBrandIdSameDnsId, response, settingFiles, operatorLevelList, getOperatorList } from "../utils.js/util.js";
import _ from 'lodash';
import 'dotenv/config';

const table_name = 'deposits';

const settleCtrl = {
    list: async (req, res, next) => {
        try {
            let is_manager = await checkIsManagerUrl(req);
            const decode_user = checkLevel(req.cookies.token, 0);
            const decode_dns = checkDns(req.cookies.dns);
            const { level, pay_type } = req.query;
            let columns = [
                `${table_name}.*`,
                `users.user_name`,
                `users.nickname`,
                `users.level`,
            ]
            let operator_list = getOperatorList(decode_dns);

            let user_id_column = '';
            let user_amount_column = '';
            if (decode_user?.level >= 40) {
                if (level == 10) {
                    user_id_column = `mcht_id`;
                    user_amount_column = `mcht_amount`;
                    columns.push(`${user_amount_column} AS user_amount`);
                }
                for (var i = 0; i < operator_list.length; i++) {
                    if (level == operator_list[i]?.value) {
                        user_id_column = `sales${operator_list[i]?.num}_id`;
                        user_amount_column = `sales${operator_list[i]?.num}_amount`;
                        columns.push(`${user_amount_column} AS user_amount`);
                    }
                }
            } else {
                if (decode_user?.level == 10) {
                    user_id_column = `mcht_id`;
                    user_amount_column = `mcht_amount`;
                    columns.push(`${user_amount_column} AS user_amount`);
                }
                for (var i = 0; i < operator_list.length; i++) {
                    if (decode_user?.level == operator_list[i]?.value) {
                        user_id_column = `sales${operator_list[i]?.num}_id`;
                        user_amount_column = `sales${operator_list[i]?.num}_amount`;
                        columns.push(`${user_amount_column} AS user_amount`);
                    }
                }
            }
            columns.push(`SUM(${table_name}.${user_amount_column}) OVER (PARTITION BY ${table_name}.${user_id_column} ORDER BY ${table_name}.id) AS new_amount`);



            let sql = `SELECT ${process.env.SELECT_COLUMN_SECRET} FROM ${table_name} `;
            sql += ` LEFT JOIN users ON ${table_name}.${user_id_column}=users.id `;
            let where_sql = ` WHERE ${table_name}.brand_id=${decode_dns?.id} `;
            if (pay_type) {
                where_sql += ` AND ${table_name}.pay_type=${pay_type} `
            }

            if (decode_user?.level >= 40) {
                where_sql += ` AND ${table_name}.${user_id_column} > 0 `;
                if (req.query[user_id_column] > 0) {
                    where_sql += ` AND ${table_name}.${user_id_column}=${req.query[user_id_column]} `;
                }
            } else {
                where_sql += ` AND ${table_name}.${user_id_column}=${decode_user?.id} `;
            }
            sql = sql + where_sql;
            let data = await getSelectQuery(sql, columns, req.query);

            return response(req, res, 100, "success", data);
        } catch (err) {
            console.log(err)
            return response(req, res, -200, "서버 에러 발생", false)
        } finally {

        }
    },
};

export default settleCtrl;
