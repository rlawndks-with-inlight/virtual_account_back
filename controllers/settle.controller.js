'use strict';
import { checkIsManagerUrl, returnMoment } from "../utils.js/function.js";
import { deleteQuery, getSelectQuery, insertQuery, makeSearchQuery, makeSearchQueryExact, selectQuerySimple, updateQuery } from "../utils.js/query-util.js";
import { checkDns, checkLevel, getNumberByPercent, isItemBrandIdSameDnsId, response, settingFiles, operatorLevelList, getOperatorList } from "../utils.js/util.js";
import _ from 'lodash';
import 'dotenv/config';
import { readPool } from "../config/db-pool.js";

const table_name = 'deposits';

const settleCtrl = {
    list: async (req, res, next) => {
        try {
            let is_manager = await checkIsManagerUrl(req);
            const decode_user = await checkLevel(req.cookies.token, 0, req);
            const decode_dns = checkDns(req.cookies.dns);
            const {
                level, pay_type, s_dt, e_dt, search,
                is_asc,
                page,
                page_size,
            } = req.query;
            if ([10, 20, 30, 50, 100].includes(page_size)) {
                return response(req, res, -100, "페이지 크기가 잘못되었습니다.", false)
            }
            let search_columns = [
                `${table_name}.trx_id`,
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
            let join_sql = ``;
            join_sql += ` LEFT JOIN users ON ${table_name}.${user_id_column}=users.id `;
            let where_sql = ` WHERE ${table_name}.brand_id=${decode_dns?.id} `;
            if (s_dt) {
                where_sql += ` AND ${table_name}.created_at >= '${s_dt} 00:00:00' `;
            }
            if (e_dt) {
                where_sql += ` AND ${table_name}.created_at <= '${e_dt} 23:59:59' `;
            }
            if (decode_user?.level >= 40) {
                where_sql += ` AND ${table_name}.${user_id_column} > 0 `;
                if (req.query[user_id_column] > 0) {
                    where_sql += ` AND ${table_name}.${user_id_column}=${req.query[user_id_column]} `;
                }
            } else {
                where_sql += ` AND ${table_name}.${user_id_column}=${decode_user?.id} `;
            }
            if (pay_type) {
                where_sql += ` AND ${table_name}.pay_type=${pay_type} `
            }
            if (search) {
                where_sql += makeSearchQueryExact(search_columns, search);
            }
            //chart
            let chart_columns = [
                `COUNT(*) AS total`,
            ];
            chart_columns.push(`SUM(${user_amount_column}) AS user_amount`);

            let chart_sql = sql + where_sql;
            chart_sql = chart_sql.replaceAll(process.env.SELECT_COLUMN_SECRET, chart_columns.join());

            sql = sql + join_sql + where_sql;
            sql += ` ORDER BY ${table_name}.id ${is_asc ? 'ASC' : 'DESC'} `;
            sql = sql.replaceAll(process.env.SELECT_COLUMN_SECRET, columns.join());
            let data = {};
            let chart = await readPool.query(chart_sql);
            chart = chart[0];
            if (chart[0]?.total >= 1 * page_size) {
                sql += ` LIMIT ${(page - 1) * page_size}, ${page_size} `;
            }
            let content = await readPool.query(sql);
            content = content[0];
            data = {
                content,
                chart,
            }
            for (var i = 0; i < data.content.length; i++) {
                let keys = Object.keys(data.content[i]);
                for (var j = 0; j < keys.length; j++) {
                    if (keys[j].includes('d_at')) {
                        data.content[i][keys[j]] = returnMoment(data.content[i][keys[j]])
                    }
                }
            }
            data.chart = data?.chart[0] ?? {};
            data = {
                ...data,
                total: data.chart?.total,
                page,
                page_size,
            }
            return response(req, res, 100, "success", data);

        } catch (err) {
            console.log(err)
            return response(req, res, -200, "서버 에러 발생", false)
        } finally {

        }
    },
    checkDeposit: async (req, res, next) => {
        try {
            let is_manager = await checkIsManagerUrl(req);
            const decode_user = await checkLevel(req.cookies.token, 0, req);
            const decode_dns = checkDns(req.cookies.dns);
            const { level, id } = req.body;

            let user_id_column = '';
            let user_amount_column = '';
            let operator_list = getOperatorList(decode_dns);

            if (decode_user?.level >= 40) {
                if (level == 10) {
                    user_id_column = `mcht_id`;
                    user_amount_column = `mcht_amount`;
                }
                for (var i = 0; i < operator_list.length; i++) {
                    if (level == operator_list[i]?.value) {
                        user_id_column = `sales${operator_list[i]?.num}_id`;
                        user_amount_column = `sales${operator_list[i]?.num}_amount`;
                    }
                }
            } else {
                if (decode_user?.level == 10) {
                    user_id_column = `mcht_id`;
                    user_amount_column = `mcht_amount`;
                }
                for (var i = 0; i < operator_list.length; i++) {
                    if (decode_user?.level == operator_list[i]?.value) {
                        user_id_column = `sales${operator_list[i]?.num}_id`;
                        user_amount_column = `sales${operator_list[i]?.num}_amount`;
                    }
                }
            }
            let data = await readPool.query(`SELECT SUM(${user_amount_column}) AS new_amount FROM ${table_name} WHERE id <= ${id} AND ${user_id_column}=${req.body[user_id_column]}`);
            data = data[0][0];
            return response(req, res, 100, "success", data);
        } catch (err) {
            console.log(err)
            return response(req, res, -200, "서버 에러 발생", false)
        } finally {

        }
    },
};

export default settleCtrl;
