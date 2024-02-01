'use strict';
import { pool } from "../config/db.js";
import { checkIsManagerUrl } from "../utils.js/function.js";
import { deleteQuery, getSelectQuery, insertQuery, selectQuerySimple, updateQuery } from "../utils.js/query-util.js";
import { checkDns, checkLevel, getOperatorList, isItemBrandIdSameDnsId, response, settingFiles } from "../utils.js/util.js";
import 'dotenv/config';

const dashboardCtrl = {
    mchtDeposit: async (req, res, next) => {
        try {
            let is_manager = await checkIsManagerUrl(req);
            const decode_user = checkLevel(req.cookies.token, 0);
            const decode_dns = checkDns(req.cookies.dns);
            const { s_dt, e_dt } = req.query;
            let amount_sub_sql = ` SELECT SUM(amount) FROM deposits  `;
            let count_sub_sql = ` SELECT COUNT(*) FROM deposits `;
            let mcht_amount_sub_sql = ` SELECT SUM(mcht_amount) FROM deposits `;
            let sub_query_where_sql = ` WHERE mcht_id=users.id AND users.brand_id=${decode_dns?.id} AND pay_type=0 `;
            if (s_dt) {
                sub_query_where_sql += ` AND created_at >= '${s_dt} 00:00:00' `;
            }
            if (e_dt) {
                sub_query_where_sql += ` AND created_at <= '${e_dt} 23:59:59' `;
            }
            amount_sub_sql += sub_query_where_sql;
            count_sub_sql += sub_query_where_sql;
            mcht_amount_sub_sql += sub_query_where_sql;
            let columns = [
                `users.*`,
                `users.nickname AS label`,
                `(${amount_sub_sql}) AS amount`,
                `(${count_sub_sql}) AS count`,
                `(${mcht_amount_sub_sql}) AS mcht_amount`,
            ]
            let sql = `SELECT ${columns.join()} FROM users `;
            sql += ` WHERE users.level=10 AND users.brand_id=${decode_dns?.id} `;

            let operator_list = getOperatorList(decode_dns);
            for (var i = 0; i < operator_list.length; i++) {
                if (operator_list[i].value == decode_user?.level) {
                    sql += ` AND users.id IN (SELECT mcht_id FROM deposits WHERE pay_type=0 AND sales${operator_list[i].num}_id=${decode_user?.id}) `;
                }
            }

            if (decode_user?.level == 10) {
                sql += ` AND users.id=${decode_user?.id} `;
            }
            sql += ` HAVING amount > 0 `;
            sql += ` ORDER BY amount DESC `;
            let result = await pool.query(sql);
            result = result?.result;
            return response(req, res, 100, "success", result);
        } catch (err) {
            console.log(err)
            return response(req, res, -200, "서버 에러 발생", false)
        } finally {

        }
    },
    amount: async (req, res, next) => {
        try {
            let is_manager = await checkIsManagerUrl(req);
            const decode_user = checkLevel(req.cookies.token, 0);
            const decode_dns = checkDns(req.cookies.dns);
            const { s_dt, e_dt, time_type, pay_type = 'deposit' } = req.query;

            let pay_type_join = '';
            let where_sql = '';
            if (pay_type == 'deposit') {
                pay_type_join = '(0)';
                where_sql = ` AND amount > 0 `;
            } else if (pay_type == 'withdraw') {
                pay_type_join = '(5, 20)';
                where_sql = ` AND amount < 0 `;
            }
            let columns = [
                `deposits.amount`,
                `deposits.created_at`,
                `deposits.withdraw_fee`,
            ]
            let sql = `SELECT ${columns.join()} FROM deposits `;
            sql += ` WHERE pay_type IN ${pay_type_join} AND deposits.brand_id=${decode_dns?.id} `;
            sql += where_sql;
            let operator_list = getOperatorList(decode_dns);
            for (var i = 0; i < operator_list.length; i++) {
                if (operator_list[i].value == decode_user?.level) {
                    sql += ` AND deposits.sales${operator_list[i].num}_id=${decode_user?.id} `;
                }
            }
            if (decode_user?.level == 10) {
                sql += ` AND deposits.mcht_id=${decode_user?.id} `;
            }
            if (s_dt) {
                sql += ` AND created_at >= '${s_dt} 00:00:00' `;
            }
            if (e_dt) {
                sql += ` AND created_at <= '${e_dt} 23:59:59' `;
            }
            sql += ` ORDER BY created_at DESC `;
            let data = await pool.query(sql);
            data = data?.result;
            let chart_obj = {

            };
            for (var i = 0; i < data.length; i++) {
                let date_format = '';
                if (time_type == 'time') {
                    date_format = data[i]?.created_at.substring(0, 13);
                    date_format += '시'
                } else if (time_type == 'date') {
                    date_format = data[i]?.created_at.substring(0, 10);
                } else if (time_type == 'month') {
                    date_format = data[i]?.created_at.substring(0, 7);
                }
                if (!chart_obj[date_format]) {
                    chart_obj[date_format] = {
                        amount: 0,
                        withdraw_fee: 0,
                        count: 0,
                    };
                }
                chart_obj[date_format].amount += parseFloat(data[i]?.amount) + data[i]?.withdraw_fee;
                chart_obj[date_format].count++;
            }
            let result = [];
            for (var i = 0; i < Object.keys(chart_obj).length; i++) {
                let key = Object.keys(chart_obj)[i];
                result.push({
                    amount: chart_obj[key].amount,
                    label: key,
                    count: chart_obj[key].count,
                })
            }
            return response(req, res, 100, "success", result);
        } catch (err) {
            console.log(err)
            return response(req, res, -200, "서버 에러 발생", false)
        } finally {

        }
    },
};

export default dashboardCtrl;
