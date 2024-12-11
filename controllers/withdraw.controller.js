'use strict';
import _ from "lodash";
import db, { pool } from "../config/db.js";
import corpApi from "../utils.js/corp-util/index.js";
import { checkIsManagerUrl, returnMoment } from "../utils.js/function.js";
import { deleteQuery, getMultipleQueryByWhen, getSelectQuery, insertQuery, makeSearchQuery, selectQuerySimple, updateQuery } from "../utils.js/query-util.js";
import { checkDns, checkLevel, commarNumber, generateRandomString, getMotherDeposit, getOperatorList, getReqIp, isItemBrandIdSameDnsId, lowLevelException, operatorLevelList, response, setWithdrawAmountSetting, settingFiles } from "../utils.js/util.js";
import 'dotenv/config';
import userCtrl from "./user.controller.js";
import axios from "axios";
import withdrawV1Ctrl from "./withdraw/v1.js";
import withdrawV2Ctrl from "./withdraw/v2.js";
import withdrawV3Ctrl from "./withdraw/v3.js";
import withdrawV4Ctrl from "./withdraw/v4.js";
import withdrawV5Ctrl from "./withdraw/v5.js";
import redisCtrl from "../redis/index.js";

const table_name = 'deposits';


const withdrawCtrl = {
    list: async (req, res, next) => {
        try {
            let is_manager = await checkIsManagerUrl(req);
            const decode_user = await checkLevel(req.cookies.token, 10, req);
            const decode_dns = checkDns(req.cookies.dns);
            const { withdraw_status, search, s_dt, e_dt, is_hand } = req.query;
            if (!decode_user) {
                return lowLevelException(req, res);
            }
            let search_columns = [
                `users.user_name`,
                `users.nickname`,
                `${table_name}.settle_acct_num`,
                `${table_name}.settle_acct_name`,
                `${table_name}.trx_id`,
            ]
            let default_columns = [
                `${table_name}.id`,
                `${table_name}.created_at`,
                `${table_name}.updated_at`,
                `${table_name}.pay_type`,
                `${table_name}.note`,
                `${table_name}.virtual_acct_balance`,
                `${table_name}.amount`,
                `${table_name}.expect_amount`,
                `${table_name}.trx_id`,
                `${table_name}.settle_bank_code`,
                `${table_name}.settle_acct_num`,
                `${table_name}.settle_acct_name`,
                `${table_name}.withdraw_fee`,
                `${table_name}.withdraw_status`,
                `${table_name}.is_withdraw_hold`,
                `${table_name}.is_hand`,
            ]
            let columns = [
                ...default_columns,
                `users.user_name`,
                `users.nickname`,
                `users.level`,
                `users.mid`,
            ]
            let operator_list = getOperatorList(decode_dns);

            let sql = `SELECT ${process.env.SELECT_COLUMN_SECRET} FROM ${table_name} `;
            sql += ` LEFT JOIN users ON ${table_name}.user_id=users.id `;

            for (var i = 0; i < operator_list.length; i++) {
                if (decode_user?.level >= operator_list[i]?.value) {
                    columns = [...columns, ...[
                        `sales${operator_list[i]?.num}.user_name AS sales${operator_list[i]?.num}_user_name`,
                        `sales${operator_list[i]?.num}.nickname AS sales${operator_list[i]?.num}_nickname`,
                        `sales${operator_list[i]?.num}.level AS sales${operator_list[i]?.num}_level`,
                        `sales${operator_list[i]?.num}.mid AS sales${operator_list[i]?.num}_mid`,
                    ]]
                    sql += ` LEFT JOIN users AS sales${operator_list[i]?.num} ON ${table_name}.sales${operator_list[i]?.num}_id=sales${operator_list[i]?.num}.id `;
                }
            }

            let where_sql = ` WHERE ${table_name}.brand_id=${decode_dns?.id} AND pay_type IN (5, 10, 20) `;
            if (decode_user?.level < 40) {
                if (decode_user?.level == 10) {
                    where_sql += ` AND ${table_name}.mcht_id=${decode_user?.id} `;
                } else {
                    let sales_num = _.find(operatorLevelList, { level: decode_user?.level })?.num;
                    where_sql += ` AND ${table_name}.sales${sales_num}_id=${decode_user?.id} `;
                }
            }
            for (var i = 0; i < operator_list.length; i++) {
                if (req.query[`sales${operator_list[i]?.num}_id`] > 0) {
                    where_sql += ` AND ${table_name}.sales${operator_list[i]?.num}_id=${req.query[`sales${operator_list[i]?.num}_id`]} `;
                }
            }
            if (req.query?.mcht_id > 0) {
                where_sql += ` AND ${table_name}.mcht_id=${req.query?.mcht_id} `;
            }
            if (withdraw_status) {
                where_sql += ` AND ${table_name}.withdraw_status=${withdraw_status} `;
            }
            if (is_hand) {
                where_sql += ` AND ${table_name}.is_hand=${is_hand} `;
            }
            if (search) {
                where_sql += makeSearchQuery(search_columns, search);
            }

            sql = sql + where_sql;
            let chart_columns = [
                `SUM(${table_name}.expect_amount) AS expect_amount`,
                `SUM(${table_name}.amount) AS amount`,
                `SUM(${table_name}.withdraw_fee) AS withdraw_fee`,
            ]
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
    get: async (req, res, next) => {
        try {
            let is_manager = await checkIsManagerUrl(req);
            const decode_user = await checkLevel(req.cookies.token, 0, req);
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
            let {
                withdraw_amount,
                pay_type,
            } = req.body;

            let dns_data = await redisCtrl.get(`dns_data_${decode_dns?.api_key}`);
            if (dns_data) {
                dns_data = JSON.parse(dns_data ?? "{}");
            } else {
                dns_data = await pool.query(`SELECT * FROM brands WHERE api_key=?`, [decode_dns?.api_key]);
                dns_data = dns_data?.result[0];
                await redisCtrl.set(`dns_data_${decode_dns?.api_key}`, JSON.stringify(dns_data), 60);
            }

            let operator_list = getOperatorList(dns_data);

            let mcht_sql = `SELECT ${process.env.SELECT_COLUMN_SECRET} FROM users `;
            mcht_sql += ` LEFT JOIN merchandise_columns ON merchandise_columns.mcht_id=users.id `;
            mcht_sql += ` LEFT JOIN virtual_accounts ON users.virtual_account_id=virtual_accounts.id `;
            let mcht_columns = [
                `users.*`,
                `merchandise_columns.mcht_fee`,
            ]
            for (var i = 0; i < operator_list.length; i++) {
                mcht_columns.push(`merchandise_columns.sales${operator_list[i]?.num}_id`);
                mcht_columns.push(`merchandise_columns.sales${operator_list[i]?.num}_fee`);
                mcht_columns.push(`merchandise_columns.sales${operator_list[i]?.num}_withdraw_fee`);
                mcht_columns.push(`sales${operator_list[i]?.num}.user_name AS sales${operator_list[i]?.num}_user_name`);
                mcht_columns.push(`sales${operator_list[i]?.num}.nickname AS sales${operator_list[i]?.num}_nickname`);
                mcht_sql += ` LEFT JOIN users AS sales${operator_list[i]?.num} ON sales${operator_list[i]?.num}.id=merchandise_columns.sales${operator_list[i]?.num}_id `;
            }
            mcht_sql += ` WHERE users.id=? `;
            mcht_sql = mcht_sql.replace(process.env.SELECT_COLUMN_SECRET, mcht_columns.join())
            let user = await pool.query(mcht_sql, [decode_user?.id]);
            user = user?.result[0];

            withdraw_amount = parseInt(withdraw_amount);
            let amount = parseInt(withdraw_amount) + (dns_data?.withdraw_fee_type == 0 ? user?.withdraw_fee : 0);
            let trx_id = `withdraw${new Date().getTime()}${generateRandomString(5)}${user?.id}`;
            let first_obj = {
                brand_id: decode_dns?.id,
                pay_type: pay_type,
                expect_amount: (-1) * amount,
                withdraw_fee: user?.withdraw_fee,
                user_id: user?.id,
                withdraw_status: 5,
                note: '',
                trx_id,
                settle_bank_code: user?.withdraw_bank_code,
                settle_acct_num: user?.withdraw_acct_num,
                settle_acct_name: user?.withdraw_acct_name,
            }
            let withdraw_obj = await setWithdrawAmountSetting(withdraw_amount, user, dns_data)
            let obj = {
                ...first_obj,
                ...withdraw_obj,
            }
            let first_result = await insertQuery(`deposits`, obj);
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
    updateTrxId: async (req, res, next) => {
        try {
            let is_manager = await checkIsManagerUrl(req);
            const decode_user = await checkLevel(req.cookies.token, 0, req);
            const decode_dns = checkDns(req.cookies.dns);
            if (!decode_user) {
                return lowLevelException(req, res);
            }
            const {
                id
            } = req.params;
            const {
                trx_id
            } = req.body;
            let obj = {
                trx_id
            };

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

            return response(req, res, 100, "success", {})
        } catch (err) {
            console.log(err)
            return response(req, res, -200, "서버 에러 발생", false)
        } finally {

        }
    },
    motherDeposit: async (req, res, next) => {
        try {
            let is_manager = await checkIsManagerUrl(req);
            const decode_user = await checkLevel(req.cookies.token, 40, req);
            const decode_dns = checkDns(req.cookies.dns);
            if (!decode_user) {
                return lowLevelException(req, res);
            }
            let data = await getMotherDeposit(decode_dns, true);
            return response(req, res, 100, "success", data)
        } catch (err) {
            console.log(err)
            return response(req, res, -200, "서버 에러 발생", false)
        } finally {

        }
    },
    motherDepositRequest: async (req, res, next) => {
        try {
            let is_manager = await checkIsManagerUrl(req);
            const decode_user = await checkLevel(req.cookies.token, 40, req);
            const decode_dns = checkDns(req.cookies.dns);
            if (!decode_user) {
                return lowLevelException(req, res);
            }
            const {
                withdraw_amount, pay_type = 10, note = "",
                is_deposit = 0,
            } = req.body;

            let data = await getMotherDeposit(decode_dns);
            if (withdraw_amount > data?.real_amount) {
                return response(req, res, -100, "출금 실패 A", false)
            }
            if (decode_dns?.parent_id > 0) {
                return response(req, res, -100, "출금 실패 A", false)
            }
            let user = await pool.query(`SELECT only_connect_ip FROM users WHERE id=${decode_dns?.id}`);
            user = user?.result[0];

            let requestIp = getReqIp(req);
            if (user?.only_connect_ip) {
                if (requestIp != user?.only_connect_ip) {
                    return response(req, res, -150, "권한이 없습니다.", false)
                }
            }
            let ip_list = await pool.query(`SELECT * FROM permit_ips WHERE user_id=${decode_user?.id} AND is_delete=0`);
            ip_list = ip_list?.result;
            if (user?.level < 45 && (!ip_list.map(itm => { return itm?.ip }).includes(requestIp))) {
                return response(req, res, -150, "권한이 없습니다.", false)
            }

            let trx_id = `${decode_dns?.id}${new Date().getTime()}`;
            let dns_data = await pool.query(`SELECT * FROM brands WHERE id=${decode_dns?.id}`);
            dns_data = dns_data?.result[0];
            dns_data['setting_obj'] = JSON.parse(dns_data?.setting_obj ?? '{}');
            if (dns_data?.withdraw_corp_type != 7) {
                return response(req, res, -100, "출금 실패 C", false)
            }
            let deposit_obj = {
                brand_id: decode_dns?.id,
                pay_type,
                expect_amount: (-1) * withdraw_amount,
                settle_bank_code: data?.brand?.settle_bank_code ?? "",
                settle_acct_num: data?.brand?.settle_acct_num ?? "",
                settle_acct_name: data?.brand?.settle_acct_name ?? "",
                withdraw_status: 5,
                note: note
            }
            let result = await insertQuery(`${table_name}`, deposit_obj);
            let withdraw_id = result?.result?.insertId;
            let api_withdraw_request_result = {};
            if (data?.brand?.settle_acct_num) {
                let api_move_to_user_amount_result = await corpApi.transfer.pass({
                    pay_type: 'deposit',
                    dns_data: decode_dns,
                    decode_user: {},
                    from_guid: data?.brand?.deposit_guid,
                    to_guid: data?.brand?.guid,
                    amount: withdraw_amount,
                })
                if (api_move_to_user_amount_result.code != 100) {
                    return response(req, res, -100, (api_move_to_user_amount_result?.message || "서버 에러 발생"), api_move_to_user_amount_result?.data)
                }
                let result2 = await updateQuery(`${table_name}`, {
                    is_pass_confirm: 1,
                }, withdraw_id);

                api_withdraw_request_result = await corpApi.withdraw.request({
                    pay_type: 'deposit',
                    dns_data: decode_dns,
                    decode_user: {},
                    guid: data?.brand?.guid,
                    amount: withdraw_amount,
                    bank_code: data?.brand?.settle_bank_code,
                    acct_num: data?.brand?.settle_acct_num,
                    acct_name: data?.brand?.settle_acct_name,
                })
                if (api_withdraw_request_result.code != 100) {
                    return response(req, res, -100, (api_withdraw_request_result?.message || "서버 에러 발생"), api_withdraw_request_result?.data)
                }
            } else {
                api_withdraw_request_result = await corpApi.mcht.withdraw_request({
                    pay_type: 'deposit',
                    dns_data: decode_dns,
                    decode_user: {},
                    guid: data?.brand?.withdraw_guid,
                    amount: withdraw_amount,
                    is_deposit,
                    trx_id,
                })
                if (api_withdraw_request_result.code != 100) {
                    return response(req, res, -100, (api_withdraw_request_result?.message || "서버 에러 발생"), api_withdraw_request_result?.data)
                }
            }


            let result3 = await updateQuery(`${table_name}`, {
                trx_id: api_withdraw_request_result.data?.tid,
                top_office_amount: api_withdraw_request_result.data?.top_amount ?? 0,
            }, withdraw_id);
            let tid = api_withdraw_request_result.data?.tid;

            if ([2, 5, 7].includes(dns_data?.withdraw_corp_type)) {
                for (var i = 0; i < 3; i++) {
                    let api_result2 = await corpApi.withdraw.request_check({
                        pay_type: 'withdraw',
                        dns_data: dns_data,
                        decode_user: {},
                        date: returnMoment().substring(0, 10).replaceAll('-', ''),
                        tid,
                    })
                    let status = 0;
                    if (api_result2.data?.status == 3) {
                        status = 10;
                    } else if (api_result2.data?.status == 6) {
                        continue;
                    }
                    if (api_result2.code == 100 || status == 10) {
                        let update_obj = {
                            withdraw_status: status,
                            amount: deposit_obj?.expect_amount,
                        }
                        if (status == 0) {
                            update_obj = {
                                ...update_obj,
                            }
                        }

                        let result = await updateQuery(`deposits`, update_obj, withdraw_id)
                        break;
                    }
                }
            }
            return response(req, res, 100, "success", {})
        } catch (err) {
            console.log(err)
            return response(req, res, -200, "서버 에러 발생", false)
        } finally {

        }
    },
    confirm: async (req, res, next) => {
        try {
            let is_manager = await checkIsManagerUrl(req);
            const decode_user = await checkLevel(req.cookies.token, 40, req);
            const decode_dns = checkDns(req.cookies.dns);
            let {
                id,
            } = req.body;
            if (!decode_user) {
                return lowLevelException(req, res);
            }
            let withdraw = await pool.query(`SELECT * FROM ${table_name} WHERE id=${id} AND brand_id=${decode_dns?.id}`);
            withdraw = withdraw?.result[0];
            if (!withdraw) {
                return response(req, res, -100, "잘못된 출금 입니다.", false)
            }
            if (withdraw?.is_pass_confirm == 1) {
                return response(req, res, -100, "이미 허용된 출금입니다.", false)
            }
            let trx_id = withdraw?.trx_id;
            let dns_data = await pool.query(`SELECT * FROM brands WHERE id=${decode_dns?.id}`);
            dns_data = dns_data?.result[0];
            dns_data['setting_obj'] = JSON.parse(dns_data?.setting_obj ?? '{}');

            let withdraw_amount = (withdraw?.expect_amount + withdraw?.withdraw_fee) * (-1);
            if (dns_data?.withdraw_max_price > 0) {
                let date = returnMoment().substring(0, 10);
                let today_withdraw_sum_sql = ` SELECT SUM(amount) AS amount FROM deposits WHERE brand_id=${decode_dns?.id} `;
                today_withdraw_sum_sql += ` AND pay_type IN (5, 10, 20) `;
                today_withdraw_sum_sql += ` AND (created_at BETWEEN '${date} 00:00:00' AND '${date} 23:59:59')  `;
                let today_withdraw_sum = await pool.query(today_withdraw_sum_sql);
                today_withdraw_sum = today_withdraw_sum?.result[0]?.amount ?? 0;
                if (dns_data?.withdraw_max_price < today_withdraw_sum + withdraw_amount) {
                    return response(req, res, -100, "출금 실패 B", false)
                }
            }
            let user = await pool.query(`SELECT * FROM users WHERE id=${withdraw?.user_id} AND brand_id=${decode_dns?.id}`);
            user = user?.result[0];

            if (!user) {
                return response(req, res, -100, "잘못된 유저 입니다.", false)
            }
            let virtual_account = await pool.query(`SELECT * FROM ${decode_dns?.deposit_type == 'virtual_account' ? 'virtual_accounts' : 'members'} WHERE id=${withdraw[`${decode_dns?.deposit_type == 'virtual_account' ? 'virtual_account_id' : 'member_id'}`]}`);
            virtual_account = virtual_account?.result[0];

            let return_time = returnMoment().substring(11, 16);
            if (dns_data?.setting_obj?.not_withdraw_s_time >= dns_data?.setting_obj?.not_withdraw_e_time) {
                if (return_time >= dns_data?.setting_obj?.not_withdraw_s_time || return_time <= dns_data?.setting_obj?.not_withdraw_e_time) {
                    return response(req, res, -100, `출금 불가 시간입니다. ${dns_data?.setting_obj?.not_withdraw_s_time} ~ ${dns_data?.setting_obj?.not_withdraw_e_time}`, false);
                }
            } else {
                if (return_time >= dns_data?.setting_obj?.not_withdraw_s_time && return_time <= dns_data?.setting_obj?.not_withdraw_e_time) {
                    return response(req, res, -100, `출금 불가 시간입니다. ${dns_data?.setting_obj?.not_withdraw_s_time} ~ ${dns_data?.setting_obj?.not_withdraw_e_time}`, false);
                }
            }

            let mother_account = await getMotherDeposit(decode_dns);
            if (withdraw_amount > mother_account?.real_amount - mother_account?.hold_amount) {
                return response(req, res, -100, "출금 실패 A", false)
            }
            let withdraw_id = withdraw?.id;
            if (withdraw?.is_pass_confirm != 1) {
                let api_move_to_user_amount_result = await corpApi.transfer.pass({
                    pay_type: 'deposit',
                    dns_data: decode_dns,
                    decode_user: user,
                    from_guid: dns_data[`deposit_guid`],
                    to_guid: virtual_account?.guid,
                    amount: withdraw_amount,
                })
                if (api_move_to_user_amount_result.code != 100) {
                    return response(req, res, -100, (api_move_to_user_amount_result?.message || "서버 에러 발생"), api_move_to_user_amount_result?.data)
                }
            }


            let result2 = await updateQuery(`${table_name}`, {
                is_pass_confirm: 1,
            }, withdraw_id);

            let api_withdraw_request_result = await corpApi.withdraw.request({
                pay_type: 'withdraw',
                dns_data: decode_dns,
                decode_user: user,
                guid: virtual_account?.guid,
                amount: withdraw_amount - (dns_data?.withdraw_fee_type == 0 ? 0 : user?.withdraw_fee),
                bank_code: virtual_account?.deposit_bank_code || withdraw?.settle_bank_code,
                acct_num: virtual_account?.deposit_acct_num || withdraw?.settle_acct_num,
                acct_name: virtual_account?.deposit_acct_name || withdraw?.settle_acct_name,
                trx_id,
            })
            if (api_withdraw_request_result.code != 100) {
                return response(req, res, -100, (api_withdraw_request_result?.message || "서버 에러 발생"), api_withdraw_request_result?.data)
            }
            let virtual_acct_balance = api_withdraw_request_result?.data?.virtual_acct_balance ?? 0;
            let tid = api_withdraw_request_result.data?.tid;
            let result3 = await updateQuery(`${table_name}`, {
                withdraw_status: 5,
                trx_id: api_withdraw_request_result.data?.tid,
                is_withdraw_hold: 0,
                top_office_amount: api_withdraw_request_result.data?.top_amount ?? 0,
                virtual_acct_balance,
            }, withdraw_id);

            if ([2, 5, 7].includes(dns_data?.withdraw_corp_type)) {
                for (var i = 0; i < 3; i++) {
                    let api_result2 = await corpApi.withdraw.request_check({
                        pay_type: 'withdraw',
                        dns_data: dns_data,
                        decode_user: user,
                        date: withdraw?.created_at.substring(0, 10).replaceAll('-', ''),
                        tid,
                    })
                    let status = 0;
                    if (api_result2.data?.status == 3) {
                        status = 10;
                    } else if (api_result2.data?.status == 6) {
                        continue;
                    }
                    if (api_result2.code == 100 || status == 10) {
                        let update_obj = {
                            withdraw_status: status,
                            amount: (status == 0 ? withdraw?.expect_amount : 0),
                        }
                        let withdraw_obj = await setWithdrawAmountSetting(withdraw_amount, user, dns_data)
                        if (status == 0) {
                            update_obj = {
                                ...update_obj,
                                ...withdraw_obj,
                            }
                        }

                        let result = await updateQuery(`deposits`, update_obj, withdraw_id)
                        break;
                    }
                }
            }
            return response(req, res, 100, "success", {})
        } catch (err) {
            console.log(err)
            return response(req, res, -200, "서버 에러 발생", false)
        } finally {

        }
    },
    refuse: async (req, res, next) => {
        try {
            let is_manager = await checkIsManagerUrl(req);
            const decode_user = await checkLevel(req.cookies.token, 40, req);
            const decode_dns = checkDns(req.cookies.dns);
            let {
                id,
            } = req.body;
            if (!decode_user) {
                return lowLevelException(req, res);
            }
            let withdraw = await pool.query(`SELECT * FROM ${table_name} WHERE id=${id} AND brand_id=${decode_dns?.id}`);
            withdraw = withdraw?.result[0];
            if (!withdraw) {
                return response(req, res, -100, "잘못된 출금 입니다.", false)
            }
            if (withdraw?.withdraw_status == 15) {
                return response(req, res, -100, "이미 반려된 건입니다.", false)
            }
            let withdraw_amount = (withdraw?.expect_amount + withdraw?.withdraw_fee) * (-1);
            let user = await pool.query(`SELECT * FROM users WHERE id=${withdraw?.user_id} AND brand_id=${decode_dns?.id}`);
            user = user?.result[0];

            if (!user) {
                return response(req, res, -100, "잘못된 유저 입니다.", false)
            }
            let virtual_account = await pool.query(`SELECT * FROM ${decode_dns?.deposit_type == 'virtual_account' ? 'virtual_accounts' : 'members'} WHERE id=${withdraw[`${decode_dns?.deposit_type == 'virtual_account' ? 'virtual_account_id' : 'member_id'}`]}`);
            virtual_account = virtual_account?.result[0];
            let dns_data = await pool.query(`SELECT * FROM brands WHERE id=${decode_dns?.id}`);
            dns_data = dns_data?.result[0];

            let withdraw_id = withdraw?.id;

            let result = await updateQuery(`${table_name}`, {
                is_withdraw_hold: 0,
                withdraw_status: 15,
                is_hand: 1,
            }, withdraw_id);
            //
            let result2 = await userCtrl.changeUserDeposit({
                ...req, IS_RETURN: true, body: {
                    amount: withdraw_amount + withdraw?.withdraw_fee,
                    pay_type: 25,
                    user_id: user?.id,
                    note: `${withdraw?.created_at}건 출금 반려`,
                }
            }, res, next);
            /*
            let trx_id = `${new Date().getTime()}${decode_dns?.id}${user?.id}5`;
            let deposit_obj = {
                brand_id: decode_dns?.id,
                pay_type,
                amount: (-1) * (parseInt(withdraw_amount) + user?.withdraw_fee),
                settle_bank_code: user?.settle_bank_code,
                settle_acct_num: user?.settle_acct_num,
                settle_acct_name: user?.settle_acct_name,
                trx_id: trx_id,
                withdraw_fee: user?.withdraw_fee,
                user_id: user?.id,
            }
            */
            return response(req, res, 100, "success", {})
        } catch (err) {
            console.log(err)
            return response(req, res, -200, "서버 에러 발생", false)
        } finally {

        }
    },
    fail: async (req, res, next) => {
        try {
            let is_manager = await checkIsManagerUrl(req);
            const decode_user = await checkLevel(req.cookies.token, 40, req);
            const decode_dns = checkDns(req.cookies.dns);
            let {
                id,
            } = req.body;
            if (!decode_user) {
                return lowLevelException(req, res);
            }
            let withdraw = await pool.query(`SELECT * FROM ${table_name} WHERE id=${id} AND brand_id=${decode_dns?.id}`);
            withdraw = withdraw?.result[0];
            if (!withdraw) {
                return response(req, res, -100, "잘못된 출금 입니다.", false)
            }
            if (withdraw?.withdraw_status == 10) {
                return response(req, res, -100, "이미 실패된 건입니다.", false)
            }
            let withdraw_amount = (withdraw?.expect_amount + withdraw?.withdraw_fee) * (-1);
            let user = await pool.query(`SELECT * FROM users WHERE id=${withdraw?.user_id} AND brand_id=${decode_dns?.id}`);
            user = user?.result[0];

            if (!user) {
                return response(req, res, -100, "잘못된 유저 입니다.", false)
            }
            let virtual_account = await pool.query(`SELECT * FROM ${decode_dns?.deposit_type == 'virtual_account' ? 'virtual_accounts' : 'members'} WHERE id=${withdraw[`${decode_dns?.deposit_type == 'virtual_account' ? 'virtual_account_id' : 'member_id'}`]}`);
            virtual_account = virtual_account?.result[0];
            let dns_data = await pool.query(`SELECT * FROM brands WHERE id=${decode_dns?.id}`);
            dns_data = dns_data?.result[0];

            let withdraw_id = withdraw?.id;
            let user_amount = await corpApi.balance.info({
                pay_type: 'withdraw',
                dns_data: decode_dns,
                decode_user,
                guid: virtual_account?.guid,
            })
            let amount = user_amount.data?.amount ?? 0
            if (amount > 0 && virtual_account) {
                let mother_to_result = await corpApi.transfer.pass({
                    pay_type: 'deposit',
                    dns_data,
                    decode_user,
                    from_guid: virtual_account?.guid,
                    to_guid: dns_data[`deposit_guid`],
                    amount: amount,
                })
                let obj = {
                    brand_id: decode_dns?.id,
                    virtual_account_id: decode_dns?.deposit_type == 'virtual_account' ? virtual_account?.id : null,
                    member_id: decode_dns?.deposit_type == 'virtual_account' ? null : virtual_account?.id,
                    amount,
                    expect_amount: amount,
                    deposit_bank_code: virtual_account?.deposit_bank_code,
                    deposit_acct_num: virtual_account?.deposit_acct_num,
                    deposit_acct_name: virtual_account?.deposit_acct_name,
                    pay_type: 15,
                    trx_id: mother_to_result.data?.tid,
                };
                let result = await insertQuery(`deposits`, obj);
            }
            let result = await updateQuery(`${table_name}`, {
                is_withdraw_hold: 0,
                withdraw_status: 10,
                is_hand: 1,
            }, withdraw_id);

            let result2 = await userCtrl.changeUserDeposit({
                ...req, IS_RETURN: true, body: {
                    amount: withdraw_amount + withdraw?.withdraw_fee,
                    pay_type: 25,
                    user_id: user?.id,
                    note: `${withdraw?.created_at}건 출금 실패`,
                }
            }, res, next);

            /*
            let trx_id = `${new Date().getTime()}${decode_dns?.id}${user?.id}5`;
            let deposit_obj = {
                brand_id: decode_dns?.id,
                pay_type,
                amount: (-1) * (parseInt(withdraw_amount) + user?.withdraw_fee),
                settle_bank_code: user?.settle_bank_code,
                settle_acct_num: user?.settle_acct_num,
                settle_acct_name: user?.settle_acct_name,
                trx_id: trx_id,
                withdraw_fee: user?.withdraw_fee,
                user_id: user?.id,
            }
            */
            return response(req, res, 100, "success", {})
        } catch (err) {
            console.log(err)
            return response(req, res, -200, "서버 에러 발생", false)
        } finally {

        }
    },
    success: async (req, res, next) => {
        try {
            let is_manager = await checkIsManagerUrl(req);
            const decode_user = await checkLevel(req.cookies.token, 40, req);
            const decode_dns = checkDns(req.cookies.dns);
            let {
                id,
            } = req.body;
            if (!decode_user) {
                return lowLevelException(req, res);
            }
            let withdraw = await pool.query(`SELECT * FROM ${table_name} WHERE id=${id} AND brand_id=${decode_dns?.id}`);
            withdraw = withdraw?.result[0];
            if (!withdraw) {
                return response(req, res, -100, "잘못된 출금 입니다.", false)
            }
            if (withdraw?.withdraw_status == 0) {
                return response(req, res, -100, "이미 성공된 건입니다.", false)
            }
            let withdraw_amount = (withdraw?.expect_amount + withdraw?.withdraw_fee) * (-1);
            let user = await pool.query(`SELECT * FROM users WHERE id=${withdraw?.user_id} AND brand_id=${decode_dns?.id}`);
            user = user?.result[0];

            if (!user) {
                return response(req, res, -100, "잘못된 유저 입니다.", false)
            }
            let virtual_account = await pool.query(`SELECT * FROM virtual_accounts WHERE id=${withdraw[`${decode_dns?.deposit_type == 'virtual_account' ? 'virtual_account_id' : 'member_id'}`]}`);
            virtual_account = virtual_account?.result[0];
            let dns_data = await pool.query(`SELECT * FROM brands WHERE id=${decode_dns?.id}`);
            dns_data = dns_data?.result[0];

            let withdraw_id = withdraw?.id;

            let result = await updateQuery(`${table_name}`, {
                is_withdraw_hold: 0,
                withdraw_status: 0,
                amount: withdraw?.expect_amount,
                is_hand: 1,
            }, withdraw_id);
            /*
            let trx_id = `${new Date().getTime()}${decode_dns?.id}${user?.id}5`;
            let deposit_obj = {
                brand_id: decode_dns?.id,
                pay_type,
                amount: (-1) * (parseInt(withdraw_amount) + user?.withdraw_fee),
                settle_bank_code: user?.settle_bank_code,
                settle_acct_num: user?.settle_acct_num,
                settle_acct_name: user?.settle_acct_name,
                trx_id: trx_id,
                withdraw_fee: user?.withdraw_fee,
                user_id: user?.id,
            }
            */
            return response(req, res, 100, "success", {})
        } catch (err) {
            console.log(err)
            return response(req, res, -200, "서버 에러 발생", false)
        } finally {

        }
    },
    request: async (req, res, next) => {
        try {
            let is_manager = await checkIsManagerUrl(req);
            const decode_user = await checkLevel(req.cookies.token, 10, req);
            const decode_dns = checkDns(req.cookies.dns);
            let {
                mid
            } = req.body;
            if (!decode_user) {
                return lowLevelException(req, res);
            }
            let user = await pool.query(`SELECT mid FROM users WHERE id=${decode_user?.id}`);
            user = user?.result[0]
            if (user?.mid != mid) {
                return response(req, res, -100, "잘못된 가맹점 접근입니다.", false)
            }
            let result = undefined;
            if (decode_dns?.setting_obj?.api_withdraw_version == 1) {
                result = await withdrawV1Ctrl.request(req, res);
            } else if (decode_dns?.setting_obj?.api_withdraw_version == 2) {
                result = await withdrawV2Ctrl.request(req, res);
            } else if (decode_dns?.setting_obj?.api_withdraw_version == 3) {
                result = await withdrawV3Ctrl.request(req, res);
            } else if (decode_dns?.setting_obj?.api_withdraw_version == 4) {
                result = await withdrawV4Ctrl.request(req, res);
            } else if (decode_dns?.setting_obj?.api_withdraw_version == 5) {
                result = await withdrawV5Ctrl.request(req, res);
            } else {
                return response(req, res, -100, "존재하지 않습니다.", false)
            }
            return response(req, res, result?.result, result?.message, result?.data)

        } catch (err) {
            console.log(err)
            return response(req, res, -200, "서버 에러 발생", false)
        } finally {

        }
    },
    check: async (req, res, next) => {
        try {
            let is_manager = await checkIsManagerUrl(req);
            const decode_user = await checkLevel(req.cookies.token, 10, req);
            const decode_dns = checkDns(req.cookies.dns);
            let {
                mid
            } = req.body;
            let body = { ...req.body };
            if (!decode_user) {
                return lowLevelException(req, res);
            }
            if (decode_user?.level >= 40) {
                body = {
                    ...body,
                    is_manager: true,
                    user_id: decode_user?.id,
                }
            } else {
                let user = await pool.query(`SELECT mid FROM users WHERE id=${decode_user?.id}`);
                user = user?.result[0]
                if (user?.mid != mid) {
                    return response(req, res, -100, "잘못된 가맹점 접근입니다.", false)
                }
            }

            let result = undefined;
            if (decode_dns?.setting_obj?.api_withdraw_version == 1) {
                result = await withdrawV1Ctrl.check(req, res);
            } else if (decode_dns?.setting_obj?.api_withdraw_version == 2) {

            } else if (decode_dns?.setting_obj?.api_withdraw_version == 3) {
                result = await withdrawV3Ctrl.check({ ...req, body: body, }, res);
            } else if (decode_dns?.setting_obj?.api_withdraw_version == 4) {

            } else if (decode_dns?.setting_obj?.api_withdraw_version == 5) {

            } else {
                return response(req, res, -100, "존재하지 않습니다.", false)
            }
            return response(req, res, result?.result, result?.message, result?.data)

        } catch (err) {
            console.log(err)
            return response(req, res, -200, "서버 에러 발생", false)
        } finally {

        }
    },
    check_withdraw: async (req, res, next) => {
        try {
            let is_manager = await checkIsManagerUrl(req);
            const decode_user = await checkLevel(req.cookies.token, 10, req);
            const decode_dns = checkDns(req.cookies.dns);
            let {
                mid
            } = req.body;
            if (!decode_user) {
                return lowLevelException(req, res);
            }
            let result = undefined;
            if (decode_dns?.setting_obj?.api_withdraw_version == 1) {
                result = await withdrawV1Ctrl.check_withdraw(req, res);
            } else if (decode_dns?.setting_obj?.api_withdraw_version == 2) {

            } else if (decode_dns?.setting_obj?.api_withdraw_version == 3) {

            } else if (decode_dns?.setting_obj?.api_withdraw_version == 4) {
                result = await withdrawV4Ctrl.check_withdraw(req, res);
            } else if (decode_dns?.setting_obj?.api_withdraw_version == 5) {
                result = await withdrawV5Ctrl.check_withdraw(req, res);
            } else {
                return response(req, res, -100, "존재하지 않습니다.", false)
            }
            return response(req, res, result?.result, result?.message, result?.data)

        } catch (err) {
            console.log(err)
            return response(req, res, -200, "서버 에러 발생", false)
        } finally {

        }
    },
};


export default withdrawCtrl;
