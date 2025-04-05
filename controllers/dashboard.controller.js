'use strict';
import _ from "lodash";
import { readPool } from "../config/db-pool.js";
import { checkIsManagerUrl, returnMoment } from "../utils.js/function.js";
import { deleteQuery, getSelectQuery, insertQuery, selectQuerySimple, updateQuery } from "../utils.js/query-util.js";
import { checkDns, checkLevel, getOperatorList, isItemBrandIdSameDnsId, lowLevelException, response, settingFiles } from "../utils.js/util.js";
import 'dotenv/config';
import redisCtrl from "../redis/index.js";

const dashboardCtrl = {
    mchtDeposit: async (req, res, next) => {
        try {
            let is_manager = await checkIsManagerUrl(req);
            const decode_user = await checkLevel(req.cookies.token, 10, req);
            const decode_dns = checkDns(req.cookies.dns);
            if (!decode_user) {
                return lowLevelException(req, res);
            }
            const { s_dt, e_dt } = req.query;
            let sub_query_where_sql = ` WHERE mcht_id=users.id AND users.brand_id=${decode_dns?.id} AND pay_type=0 `;
            if (s_dt) {
                sub_query_where_sql += ` AND created_at >= '${s_dt} 00:00:00' `;
            }
            if (e_dt) {
                sub_query_where_sql += ` AND created_at <= '${e_dt} 23:59:59' `;
            }
            let columns = [
                `users.id`,
                `users.user_name`,
                `users.mid`,
                `users.nickname AS label`,
            ]
            let sql = `SELECT ${columns.join()} FROM users `;
            sql += ` WHERE users.brand_id=${decode_dns?.id} AND users.level=10 `;

            let operator_list = getOperatorList(decode_dns);
            for (var i = 0; i < operator_list.length; i++) {
                if (operator_list[i].value == decode_user?.level) {
                    sql += ` AND users.id IN (SELECT mcht_id FROM merchandise_columns WHERE sales${operator_list[i].num}_id=${decode_user?.id}) `;
                }
            }
            if (decode_user?.level == 10) {
                sql += ` AND users.id=${decode_user?.id} `;
            }
            let users = await readPool.query(sql);
            users = users[0];
            let result = await redisCtrl.get(`dashboard_mcht_${e_dt}_${e_dt}_${decode_user?.id}_${decode_dns?.id}`);
            if (result) {
                result = JSON.parse(result ?? '[]');
            } else {
                result = [];
                if (users?.length > 0) {
                    let columns = [
                        `mcht_id`,
                        `SUM(amount) AS amount`,
                        `COUNT(*) AS count`,
                        `SUM(mcht_amount) AS mcht_amount`,
                    ];
                    let amount_sql = ` SELECT ${columns.join()} FROM deposits `;
                    amount_sql += ` WHERE brand_id=${decode_dns?.id} `;
                    if (s_dt) {
                        amount_sql += ` AND created_at >= '${s_dt} 00:00:00' `;
                    }
                    if (e_dt) {
                        amount_sql += ` AND created_at <= '${e_dt} 23:59:59' `;
                    }
                    amount_sql += ` AND pay_type=0 `;
                    amount_sql += ` AND deposit_status=0 `;
                    amount_sql += ` AND mcht_id IN (${users.map(el => { return el?.id })})`;
                    amount_sql += ` GROUP BY mcht_id `;
                    let amount_data = await readPool.query(amount_sql);
                    amount_data = amount_data[0];
                    users = users.map(el => {
                        return {
                            ...el,
                            ..._.find(amount_data, { [`mcht_id`]: el?.id })
                        }
                    })
                    result = users.filter(el => el?.count > 0);
                    result = result.sort((a, b) => {
                        if (a.amount > b.amount) return -1
                        if (a.amount < b.amount) return 1
                        return 0
                    })
                } else {
                    result = [];
                }
                await redisCtrl.set(`dashboard_mcht_${e_dt}_${e_dt}_${decode_user?.id}_${decode_dns?.id}`, JSON.stringify(result), 60);
            }

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
            const decode_user = await checkLevel(req.cookies.token, 10, req);
            const decode_dns = checkDns(req.cookies.dns);
            const { s_dt, e_dt, time_type, pay_type = 'deposit' } = req.query;
            if (!decode_user) {
                return lowLevelException(req, res);
            }
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
            let data = await readPool.query(sql);
            data = data[0];
            for (var i = 0; i < data.length; i++) {
                let keys = Object.keys(data[i]);
                for (var j = 0; j < keys.length; j++) {
                    if (keys[j].includes('d_at')) {
                        data[i][keys[j]] = returnMoment(data[i][keys[j]])
                    }
                }
            }
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
    topOfferSettle: async (req, res, next) => {
        try {
            let is_manager = await checkIsManagerUrl(req);
            const decode_user = await checkLevel(req.cookies.token, 40, req);
            const decode_dns = checkDns(req.cookies.dns);
            if (!decode_user) {
                return lowLevelException(req, res);
            }
            if (decode_dns?.is_oper_dns != 1) {
                return response(req, res, 100, "success", []);
            }
            let operator_list = getOperatorList(decode_dns);
            const { s_dt, e_dt } = req.query;
            let columns = [
                `users.id`,
                `users.user_name`,
                `users.mid`,
                `users.level`,
                `users.nickname AS label`,
            ]
            let sql = `SELECT ${columns.join()} FROM users `;
            sql += ` WHERE users.brand_id=${decode_dns?.id} AND users.level > 10 AND users.level < 40 `;


            let users = await readPool.query(sql);
            users = users[0];
            let result = await redisCtrl.get(`dashboard_oper_${e_dt}_${e_dt}_${decode_user?.id}_${decode_dns?.id}`);
            if (result) {
                result = JSON.parse(result ?? '[]');
            } else {
                result = [];
                if (users?.length > 0) {
                    for (var i = 0; i < operator_list.length; i++) {
                        if (users.filter(el => el?.level == operator_list[i]?.value).length > 0) {
                            let columns = [
                                `top_offer${operator_list[i]?.num}_id AS top_offer_id`,
                                `SUM(top_offer${operator_list[i]?.num}_amount) * -1 AS amount`,
                            ];
                            let amount_sql = ` SELECT ${columns.join()} FROM deposits `;
                            amount_sql += ` WHERE top_offer${operator_list[i]?.num}_id IN (${users.filter(el => el?.level == operator_list[i]?.value).map(el => { return el?.id }).join()}) `;
                            if (s_dt) {
                                amount_sql += ` AND created_at >= '${s_dt} 00:00:00' `;
                            }
                            if (e_dt) {
                                amount_sql += ` AND created_at <= '${e_dt} 23:59:59' `;
                            }
                            amount_sql += ` AND pay_type=5 `;
                            amount_sql += ` AND is_parent_brand_settle=1 `;
                            amount_sql += ` GROUP BY top_offer${operator_list[i]?.num}_id `;
                            let amount_data = await readPool.query(amount_sql);
                            amount_data = amount_data[0];
                            result = [...result, ...amount_data];
                        }
                    }
                    users = users.map(el => {
                        return {
                            ...el,
                            ..._.find(result, { [`top_offer_id`]: el?.id })
                        }
                    })
                    result = users.filter(el => el?.amount > 0);
                    result = result.sort((a, b) => {
                        if (a.amount > b.amount) return -1
                        if (a.amount < b.amount) return 1
                        return 0
                    })
                } else {
                    result = [];
                }
                await redisCtrl.set(`dashboard_oper_${e_dt}_${e_dt}_${decode_user?.id}_${decode_dns?.id}`, JSON.stringify(result), 60);
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
