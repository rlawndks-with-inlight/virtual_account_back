'use strict';
import { pool } from "../config/db.js";
import { checkIsManagerUrl } from "../utils.js/function.js";
import { deleteQuery, getSelectQuery, insertQuery, selectQuerySimple, updateQuery } from "../utils.js/query-util.js";
import { checkDns, checkLevel, isItemBrandIdSameDnsId, response, settingFiles } from "../utils.js/util.js";
import 'dotenv/config';

const dashboardCtrl = {
    mchtDeposit: async (req, res, next) => {
        try {
            let is_manager = await checkIsManagerUrl(req);
            const decode_user = checkLevel(req.cookies.token, 0);
            const decode_dns = checkDns(req.cookies.dns);
            const { s_dt, e_dt } = req.query;
            let sub_query = ` SELECT SUM(amount) FROM deposits WHERE mcht_id=users.id AND pay_type=0 `;
            if (s_dt) {
                sub_query += ` AND created_at >= '${s_dt} 00:00:00' `;
            }
            if (e_dt) {
                sub_query += ` AND created_at <= '${e_dt} 23:59:59' `;
            }
            let columns = [
                `users.*`,
                `users.nickname AS label`,
                `(${sub_query}) AS amount`,
            ]
            let sql = `SELECT ${columns.join()} FROM users `;
            sql += ` WHERE users.level=10 `;
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
            const { s_dt, e_dt, time_type } = req.query;
            let sub_query = ` SELECT SUM(amount) FROM deposits WHERE mcht_id=users.id AND pay_type=0 `;

            let columns = [
                `deposits.amount`,
                `deposits.created_at`,
            ]
            let sql = `SELECT ${columns.join()} FROM deposits `;
            sql += ` WHERE pay_type=0 `;
            sql += ` AND amount > 0 `;
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
                    chart_obj[date_format] = 0;
                }
                chart_obj[date_format] += parseFloat(data[i]?.amount);
            }
            let result = [];
            for (var i = 0; i < Object.keys(chart_obj).length; i++) {
                let key = Object.keys(chart_obj)[i];
                result.push({
                    amount: chart_obj[key],
                    label: key,
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
