'use strict';
import _ from "lodash";
import db, { pool } from "../config/db.js";
import corpApi from "../utils.js/corp-util/index.js";
import { checkIsManagerUrl, returnMoment } from "../utils.js/function.js";
import { deleteQuery, getMultipleQueryByWhen, getSelectQuery, insertQuery, makeSearchQuery, selectQuerySimple, updateQuery } from "../utils.js/query-util.js";
import { checkDns, checkLevel, commarNumber, getOperatorList, isItemBrandIdSameDnsId, lowLevelException, operatorLevelList, response, settingFiles } from "../utils.js/util.js";
import 'dotenv/config';

const table_name = 'deposits';


const withdrawCtrl = {
    list: async (req, res, next) => {
        try {
            let is_manager = await checkIsManagerUrl(req);
            const decode_user = checkLevel(req.cookies.token, 0);
            const decode_dns = checkDns(req.cookies.dns);
            const { withdraw_status, search, s_dt, e_dt } = req.query;
            let search_columns = [
                `users.user_name`,
                `users.nickname`,
                `${table_name}.settle_acct_num`,
                `${table_name}.settle_acct_name`,
            ]
            let columns = [
                `${table_name}.*`,
                `users.user_name`,
                `users.nickname`,
                `users.level`,
            ]
            let sql = `SELECT ${process.env.SELECT_COLUMN_SECRET} FROM ${table_name} `;
            sql += ` LEFT JOIN users ON ${table_name}.mcht_id=users.id `;
            let where_sql = ` WHERE ${table_name}.brand_id=${decode_dns?.id} AND pay_type IN (5, 20) `;
            if (decode_user?.level < 40) {
                if (decode_user?.level == 10) {
                    where_sql += ` AND ${table_name}.mcht_id=${decode_user?.id} `;
                } else {
                    let sales_num = _.find(operatorLevelList, { level: decode_user?.level })?.num;
                    where_sql += ` AND ${table_name}.sales${sales_num}_id=${decode_user?.id} `;
                }
            }
            let operator_list = getOperatorList(decode_dns);
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
            console.log(chart_data)
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
            const decode_user = checkLevel(req.cookies.token, 0);
            const decode_dns = checkDns(req.cookies.dns);
            let {
                withdraw_amount, user_id, pay_type = 5, note = "",
                virtual_account_id,
            } = req.body;
            let files = settingFiles(req.files);
            let obj = {
                withdraw_amount, user_id, pay_type
            };

            obj = { ...obj, ...files };
            let pay_type_name = '';
            if (pay_type == 5) {
                pay_type_name = '출금';
            } else if (pay_type == 20) {
                pay_type_name = '반환';
            } else {
                return response(req, res, -100, "결제타입에러", false)
            }

            let user_column = [
                `users.*`,
            ]
            let user = await pool.query(`SELECT ${user_column.join()} FROM users WHERE id=${user_id}`);
            user = user?.result[0];
            if (!virtual_account_id) {
                virtual_account_id = user?.virtual_account_id;
            }
            let virtual_account = await pool.query(`SELECT * FROM virtual_accounts WHERE id=${virtual_account_id}`);
            virtual_account = virtual_account?.result[0];
            if (!virtual_account) {
                return response(req, res, -100, "가상계좌를 먼저 등록해 주세요.", false)
            }
            let dns_data = await pool.query(`SELECT * FROM brands WHERE id=${decode_dns?.id}`);
            dns_data = dns_data?.result[0];
            dns_data['setting_obj'] = JSON.parse(dns_data?.setting_obj ?? '{}');

            let amount = parseInt(withdraw_amount) + (dns_data?.withdraw_fee_type == 0 ? user?.withdraw_fee : 0);

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

            if (pay_type == 20 && user?.can_return_ago_pay == 1) {
                let deposit_count = await pool.query(`SELECT COUNT(*) AS count FROM ${table_name} WHERE pay_type=0 AND virtual_account_id=${virtual_account_id}`);
                deposit_count = deposit_count?.result[0];
                if (deposit_count?.count < 1) {
                    return response(req, res, -100, "결제한 이력이 없는 유저이므로 반환 불가합니다.", false)
                }
            }
            let deposit_obj = {
                brand_id: decode_dns?.id,
                pay_type,
                expect_amount: (-1) * amount,
                settle_bank_code: virtual_account?.deposit_bank_code,
                settle_acct_num: virtual_account?.deposit_acct_num,
                settle_acct_name: virtual_account?.deposit_acct_name,
                withdraw_fee: user?.withdraw_fee,
                virtual_account_id: virtual_account_id,
                user_id: user?.id,
                withdraw_status: 5,
                note: note,
                withdraw_fee_type: dns_data?.withdraw_fee_type,
            }

            let settle_amount_sql = ``;
            if (user?.level == 10) {
                settle_amount_sql = `SELECT SUM(mcht_amount) AS settle_amount FROM ${table_name} WHERE mcht_id=${user?.id}`;
                deposit_obj[`mcht_id`] = user?.id
                deposit_obj[`mcht_amount`] = (-1) * amount;
            } else {
                let find_oper_level = _.find(operatorLevelList, { level: parseInt(user?.level) });
                settle_amount_sql = `SELECT SUM(sales${find_oper_level.num}_amount) AS settle_amount FROM ${table_name} WHERE sales${find_oper_level.num}_id=${user?.id}`;
                deposit_obj[`sales${find_oper_level.num}_id`] = user?.id
                deposit_obj[`sales${find_oper_level.num}_amount`] = (-1) * amount;
            }
            let settle_amount = await pool.query(settle_amount_sql);
            settle_amount = settle_amount?.result[0]?.settle_amount ?? 0;
            if (dns_data?.default_withdraw_max_price < withdraw_amount) {
                return response(req, res, -100, `최대 ${pay_type_name}액은 ${commarNumber(dns_data?.default_withdraw_max_price)}원 입니다.`, false)
            }
            if (amount > settle_amount) {
                return response(req, res, -100, `${pay_type_name} 요청금이 보유정산금보다 많습니다.`, false)
            }
            if (settle_amount < user?.min_withdraw_remain_price) {
                return response(req, res, -100, `최소 ${pay_type_name}잔액은 ${commarNumber(user?.min_withdraw_remain_price)}원 입니다.`, false)
            }
            if (parseInt(withdraw_amount) < user?.min_withdraw_price) {
                return response(req, res, -100, `최소 ${pay_type_name}액은 ${commarNumber(user?.min_withdraw_price)}원 입니다.`, false)
            }
            if (settle_amount - amount < user?.min_withdraw_hold_price) {
                return response(req, res, -100, `최소 ${pay_type_name} 보류금액은 ${commarNumber(user?.min_withdraw_hold_price)}원 입니다.`, false)
            }
            if (user?.is_withdraw_hold == 1) {
                deposit_obj['is_withdraw_hold'] = 1;
            }
            let result = await insertQuery(`${table_name}`, deposit_obj);
            if (user?.is_withdraw_hold == 1) {
                return response(req, res, 100, "출금 요청이 완료되었습니다.", {});
            }
            let mother_account = await getMotherDeposit(decode_dns);
            if (withdraw_amount > mother_account?.real_amount) {
                return response(req, res, -100, "출금 요청금이 모계좌잔액보다 많습니다.", false)
            }

            let withdraw_id = result?.result?.insertId;

            let api_move_to_user_amount_result = await corpApi.transfer.pass({
                pay_type: 'deposit',
                dns_data: decode_dns,
                decode_user: user,
                from_guid: dns_data[`deposit_guid`],
                to_guid: virtual_account?.guid,
                amount: withdraw_amount - (dns_data?.withdraw_fee_type == 0 ? 0 : user?.withdraw_fee),
            })

            if (api_move_to_user_amount_result.code != 100) {
                return response(req, res, -100, (api_move_to_user_amount_result?.message || "서버 에러 발생"), api_move_to_user_amount_result?.data)
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
            })
            if (api_withdraw_request_result.code != 100) {
                return response(req, res, -100, (api_withdraw_request_result?.message || "서버 에러 발생"), api_withdraw_request_result?.data)
            }
            let result3 = await updateQuery(`${table_name}`, {
                trx_id: api_withdraw_request_result.data?.tid,
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
            })
            if (api_withdraw_request_result.code != 100) {
                return response(req, res, -100, (api_withdraw_request_result?.message || "서버 에러 발생"), api_withdraw_request_result?.data)
            }
            let result3 = await updateQuery(`${table_name}`, {
                trx_id: api_withdraw_request_result.data?.tid,
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
            const decode_user = checkLevel(req.cookies.token, 0);
            const decode_dns = checkDns(req.cookies.dns);
            let {
                id,
            } = req.body;

            let withdraw = await pool.query(`SELECT * FROM ${table_name} WHERE id=${id} AND brand_id=${decode_dns?.id}`);
            withdraw = withdraw?.result[0];
            if (!withdraw) {
                return response(req, res, -100, "잘못된 출금 입니다.", false)
            }
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
                amount: withdraw_amount,
            })
            if (api_withdraw_request_result.code != 100) {
                return response(req, res, -100, (api_withdraw_request_result?.message || "서버 에러 발생"), api_withdraw_request_result?.data)
            }
            let result3 = await updateQuery(`${table_name}`, {
                trx_id: api_withdraw_request_result.data?.tid,
                is_withdraw_hold: 0,
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
    refuse: async (req, res, next) => {
        try {
            let is_manager = await checkIsManagerUrl(req);
            const decode_user = checkLevel(req.cookies.token, 0);
            const decode_dns = checkDns(req.cookies.dns);
            let {
                id,
            } = req.body;

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
            const decode_user = checkLevel(req.cookies.token, 0);
            const decode_dns = checkDns(req.cookies.dns);
            let {
                id,
            } = req.body;

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

const getMotherDeposit = async (decode_dns) => {

    let brand_columns = [
        `brands.*`,
        `virtual_accounts.guid`,
        `virtual_accounts.virtual_bank_code`,
        `virtual_accounts.virtual_acct_num`,
        `virtual_accounts.virtual_acct_name`,
        `virtual_accounts.deposit_bank_code AS settle_bank_code`,
        `virtual_accounts.deposit_acct_num AS settle_acct_num`,
        `virtual_accounts.deposit_acct_name AS settle_acct_name`,
    ]
    let brand_sql = `SELECT ${brand_columns.join()} FROM brands `;
    brand_sql += ` LEFT JOIN virtual_accounts ON brands.virtual_account_id=virtual_accounts.id `;
    brand_sql += ` WHERE brands.id=${decode_dns?.id} `;

    let operator_list = getOperatorList(decode_dns);

    let sum_columns = [
        `SUM(amount) AS total_amount`,
        `SUM(withdraw_fee) AS total_withdraw_fee`,
        `SUM(deposit_fee) AS total_deposit_fee`,
        `SUM(mcht_amount) AS total_mcht_amount`,
    ]
    for (var i = 0; i < operator_list.length; i++) {
        sum_columns.push(`SUM(sales${operator_list[i].num}_amount) AS total_sales${operator_list[i].num}_amount`);
    }
    let sum_sql = `SELECT ${sum_columns.join()} FROM ${table_name} WHERE brand_id=${decode_dns?.id}`;
    let sql_list = [
        { table: 'brand', sql: brand_sql },
        { table: 'sum', sql: sum_sql },
    ]
    let data = await getMultipleQueryByWhen(sql_list);
    data['brand'] = data['brand'][0];
    data['sum'] = data['sum'][0];
    data['sum'].total_oper_amount = 0;
    for (var i = 0; i < operator_list.length; i++) {
        data['sum'].total_oper_amount += data['sum'][`total_sales${operator_list[i].num}_amount`];
    }
    let real_amount = await corpApi.balance.info({
        pay_type: 'deposit',
        dns_data: data['brand'],
        decode_user: {},
        guid: data['brand']?.deposit_guid,
    })
    data['real_amount'] = real_amount.data?.amount ?? 0;

    return data;
}
export default withdrawCtrl;
