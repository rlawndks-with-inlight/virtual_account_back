'use strict';
import { checkIsManagerUrl } from "../utils.js/function.js";
import { deleteQuery, getSelectQuery, insertQuery, makeSearchQuery, selectQuerySimple, updateQuery } from "../utils.js/query-util.js";
import { checkDns, checkLevel, getNumberByPercent, isItemBrandIdSameDnsId, response, settingFiles, operatorLevelList, getOperatorList } from "../utils.js/util.js";
import _ from 'lodash';
import 'dotenv/config';

const table_name = 'deposits';

const settleCtrl = {
    list: async (req, res, next) => {
        try {
            let is_manager = await checkIsManagerUrl(req);
            const decode_user = await checkLevel(req.cookies.token, 0, req);
            const decode_dns = checkDns(req.cookies.dns);
            const { level, pay_type, s_dt, e_dt, search } = req.query;

            let search_columns = [
                `users.user_name`,
                `users.nickname`,
            ]

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
            //columns.push(`(SELECT SUM(${user_amount_column}) FROM ${table_name} AS d2 WHERE d2.id<=${table_name}.id AND d2.${user_id_column}=${table_name}.${user_id_column}) AS new_amount`);


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
            if (search) {
                where_sql += makeSearchQuery(search_columns, search);
            }
            sql = sql + where_sql;
            console.log(user_amount_column)
            //chart
            let chart_columns = [];
            chart_columns.push(`SUM(${user_amount_column}) AS user_amount`);
            let chart_sql = sql;
            if (s_dt) {
                chart_sql += ` AND ${table_name}.created_at >= '${s_dt} 00:00:00' `;
            }
            if (e_dt) {
                chart_sql += ` AND ${table_name}.created_at <= '${e_dt} 23:59:59' `;
            }
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
};

export default settleCtrl;
