'use strict';
import _ from "lodash";
import db, { pool } from "../config/db.js";
import corpApi from "../utils.js/corp-util/index.js";
import { checkIsManagerUrl, returnMoment } from "../utils.js/function.js";
import { deleteQuery, getMultipleQueryByWhen, getSelectQuery, insertQuery, makeSearchQuery, selectQuerySimple, updateQuery } from "../utils.js/query-util.js";
import { checkDns, checkLevel, commarNumber, getMotherDeposit, getOperatorList, isItemBrandIdSameDnsId, lowLevelException, operatorLevelList, response, setWithdrawAmountSetting, settingFiles } from "../utils.js/util.js";
import 'dotenv/config';
import userCtrl from "./user.controller.js";

const table_name = 'deposits';


const withdrawCtrl = {
    list: async (req, res, next) => {
        try {
            let is_manager = await checkIsManagerUrl(req);
            const decode_user = checkLevel(req.cookies.token, 10);
            const decode_dns = checkDns(req.cookies.dns);
            const { withdraw_status, search, s_dt, e_dt } = req.query;
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
            let columns = [
                `${table_name}.*`,
                `users.user_name`,
                `users.nickname`,
                `users.level`,
                `users.mid`,
            ]
            let operator_list = getOperatorList(decode_dns);

            let sql = `SELECT ${process.env.SELECT_COLUMN_SECRET} FROM ${table_name} `;
            sql += ` LEFT JOIN users ON ${table_name}.mcht_id=users.id `;
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

            let where_sql = ` WHERE ${table_name}.brand_id=${decode_dns?.id} AND pay_type IN (5, 20) `;
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
            let chart_data = await pool.query(chart_sql);
            chart_data = chart_data?.result[0];
            let data = await getSelectQuery(sql, columns, req.query);

            return response(req, res, 100, "success", { ...data, chart: chart_data });
        } catch (err) {
            console.log(err)
            return response(req, res, -200, "서버 에러 발생", false)
        } finally {

        }
    },
    get: async (req, res, next) => {
        try {
            let is_manager = await checkIsManagerUrl(req);
            const decode_user = checkLevel(req.cookies.token, 0);
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
            const decode_user = checkLevel(req.cookies.token, 10);
            const decode_dns = checkDns(req.cookies.dns);
            if (!decode_user) {
                return lowLevelException(req, res);
            }
            let {
                withdraw_amount, user_id, pay_type = 5, note = "",
                virtual_account_id,
            } = req.body;

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
            const decode_user = checkLevel(req.cookies.token, 0);
            const decode_dns = checkDns(req.cookies.dns);
            const {
                id
            } = req.body;
            let files = settingFiles(req.files);
            let obj = {
            };
            obj = { ...obj, ...files };

            let result = await updateQuery(`${table_name}`, obj, id);

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
            const decode_user = checkLevel(req.cookies.token, 0);
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
            const decode_user = checkLevel(req.cookies.token, 0);
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
    motherDeposit: async (req, res, next) => {
        try {
            let is_manager = await checkIsManagerUrl(req);
            const decode_user = checkLevel(req.cookies.token, 40);
            const decode_dns = checkDns(req.cookies.dns);
            if (!decode_user) {
                return lowLevelException(req, res);
            }
            let data = await getMotherDeposit(decode_dns);

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
            const decode_user = checkLevel(req.cookies.token, 40);
            const decode_dns = checkDns(req.cookies.dns);
            if (!decode_user) {
                return lowLevelException(req, res);
            }
            const {
                withdraw_amount, pay_type = 10, note = ""
            } = req.body;

            let data = await getMotherDeposit(decode_dns);
            if (withdraw_amount > data?.real_amount) {
                return response(req, res, -100, "출금 요청금이 모계좌잔액보다 많습니다.", false)
            }
            if (!data?.brand?.settle_acct_num) {
                return response(req, res, -100, "입금받을 계좌를 등록해 주세요.", false)
            }
            let deposit_obj = {
                brand_id: decode_dns?.id,
                pay_type,
                expect_amount: (-1) * withdraw_amount,
                settle_bank_code: data?.brand?.settle_bank_code,
                settle_acct_num: data?.brand?.settle_acct_num,
                settle_acct_name: data?.brand?.settle_acct_name,
                withdraw_status: 5,
                note: note
            }
            let result = await insertQuery(`${table_name}`, deposit_obj);
            let withdraw_id = result?.result?.insertId;

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

            let api_withdraw_request_result = await corpApi.withdraw.request({
                pay_type: 'deposit',
                dns_data: decode_dns,
                decode_user: {},
                guid: data?.brand?.guid,
                amount: withdraw_amount,
                bank_code: data?.brand?.settle_bank_code,
                acct_num: data?.brand?.settle_acct_num,
                acct_name: data?.brand?.settle_acct_name,
            })
            console.log(api_withdraw_request_result)
            if (api_withdraw_request_result.code != 100) {
                return response(req, res, -100, (api_withdraw_request_result?.message || "서버 에러 발생"), api_withdraw_request_result?.data)
            }
            let result3 = await updateQuery(`${table_name}`, {
                trx_id: api_withdraw_request_result.data?.tid,
                top_office_amount: api_withdraw_request_result.data?.top_amount ?? 0,
            }, withdraw_id);

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
            const decode_user = checkLevel(req.cookies.token, 40);
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
            let trx_id = withdraw?.trx_id;
            let dns_data = await pool.query(`SELECT * FROM brands WHERE id=${decode_dns?.id}`);
            dns_data = dns_data?.result[0];
            dns_data['setting_obj'] = JSON.parse(dns_data?.setting_obj ?? '{}');

            let withdraw_amount = (withdraw?.expect_amount + withdraw?.withdraw_fee) * (-1);
            let user = await pool.query(`SELECT * FROM users WHERE id=${withdraw?.user_id} AND brand_id=${decode_dns?.id}`);
            user = user?.result[0];

            if (!user) {
                return response(req, res, -100, "잘못된 유저 입니다.", false)
            }
            let virtual_account = await pool.query(`SELECT * FROM virtual_accounts WHERE id=${withdraw?.virtual_account_id}`);
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
            if (withdraw_amount > mother_account?.real_amount) {
                return response(req, res, -100, "출금 요청금이 모계좌잔액보다 많습니다.", false)
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

            if (dns_data?.withdraw_corp_type == 2) {
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
            const decode_user = checkLevel(req.cookies.token, 40);
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
            let withdraw_amount = (withdraw?.expect_amount + withdraw?.withdraw_fee) * (-1);
            let user = await pool.query(`SELECT * FROM users WHERE id=${withdraw?.user_id} AND brand_id=${decode_dns?.id}`);
            user = user?.result[0];

            if (!user) {
                return response(req, res, -100, "잘못된 유저 입니다.", false)
            }
            let virtual_account = await pool.query(`SELECT * FROM virtual_accounts WHERE id=${withdraw?.virtual_account_id}`);
            virtual_account = virtual_account?.result[0];
            let dns_data = await pool.query(`SELECT * FROM brands WHERE id=${decode_dns?.id}`);
            dns_data = dns_data?.result[0];

            let withdraw_id = withdraw?.id;

            let result = await updateQuery(`${table_name}`, {
                is_withdraw_hold: 0,
                withdraw_status: 15
            }, withdraw_id);
            //
            let result2 = await userCtrl.changeUserDeposit({
                ...req, IS_RETURN: true, body: {
                    amount: withdraw_amount + withdraw?.withdraw_fee,
                    pay_type: 25,
                    user_id: user?.id,
                    note: "출금 반려",
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
            const decode_user = checkLevel(req.cookies.token, 40);
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
            let withdraw_amount = (withdraw?.expect_amount + withdraw?.withdraw_fee) * (-1);
            let user = await pool.query(`SELECT * FROM users WHERE id=${withdraw?.user_id} AND brand_id=${decode_dns?.id}`);
            user = user?.result[0];

            if (!user) {
                return response(req, res, -100, "잘못된 유저 입니다.", false)
            }
            let virtual_account = await pool.query(`SELECT * FROM virtual_accounts WHERE id=${withdraw?.virtual_account_id}`);
            virtual_account = virtual_account?.result[0];
            let dns_data = await pool.query(`SELECT * FROM brands WHERE id=${decode_dns?.id}`);
            dns_data = dns_data?.result[0];

            let withdraw_id = withdraw?.id;
            let mother_to_result = await corpApi.transfer.pass({
                pay_type: 'deposit',
                dns_data,
                decode_user: user,
                from_guid: virtual_account?.guid,
                to_guid: dns_data[`deposit_guid`],
                amount: withdraw_amount,
            })
            if (mother_to_result.code == 100) {
                let update_mother_to_result = await updateQuery(`${table_name}`, {
                    is_move_mother: 0,
                }, deposit_id);
            }
            let result = await updateQuery(`${table_name}`, {
                is_withdraw_hold: 0,
                withdraw_status: 10
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
};


export default withdrawCtrl;
