'use strict';
import _ from "lodash";
import db, { pool } from "../config/db.js";
import corpApi from "../utils.js/corp-util/index.js";
import { checkIsManagerUrl } from "../utils.js/function.js";
import { deleteQuery, getMultipleQueryByWhen, getSelectQuery, insertQuery, selectQuerySimple, updateQuery } from "../utils.js/query-util.js";
import { checkDns, checkLevel, commarNumber, getOperatorList, isItemBrandIdSameDnsId, lowLevelException, operatorLevelList, response, settingFiles } from "../utils.js/util.js";
import 'dotenv/config';

const table_name = 'deposits';

const withdrawCtrl = {
    list: async (req, res, next) => {
        try {
            let is_manager = await checkIsManagerUrl(req);
            const decode_user = checkLevel(req.cookies.token, 0);
            const decode_dns = checkDns(req.cookies.dns);
            const { } = req.query;

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

            sql = sql + where_sql;
            let data = await getSelectQuery(sql, columns, req.query);

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

            let amount = parseInt(withdraw_amount) + user?.withdraw_fee;

            let dns_data = await pool.query(`SELECT * FROM brands WHERE id=${decode_dns?.id}`);
            dns_data = dns_data?.result[0];

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
            }

            let settle_amount_sql = ``;
            if (user?.level == 10) {
                settle_amount_sql = `SELECT SUM(mcht_amount) AS settle_amount FROM deposits WHERE mcht_id=${user?.id}`;
                deposit_obj[`mcht_id`] = user?.id
                deposit_obj[`mcht_amount`] = (-1) * amount;
            } else {
                let find_oper_level = _.find(operatorLevelList, { level: parseInt(user?.level) });
                settle_amount_sql = `SELECT SUM(sales${find_oper_level.num}_amount) AS settle_amount FROM deposits WHERE sales${find_oper_level.num}_id=${user?.id}`;
                deposit_obj[`sales${find_oper_level.num}_id`] = user?.id
                deposit_obj[`sales${find_oper_level.num}_amount`] = (-1) * amount;
            }
            let settle_amount = await pool.query(settle_amount_sql);
            settle_amount = settle_amount?.result[0]?.settle_amount ?? 0;
            if (amount > settle_amount) {
                return response(req, res, -100, `${pay_type_name} 요청금이 보유정산금보다 많습니다.`, false)
            }
            if (settle_amount < user?.min_withdraw_remain_price) {
                return response(req, res, -100, `최소 ${pay_type_name}잔액은 ${commarNumber(user?.min_withdraw_remain_price)}원 입니다.`, false)
            }
            if (parseInt(withdraw_amount) < user?.min_withdraw_price) {
                return response(req, res, -100, `최소 ${pay_type_name}액은 ${commarNumber(user?.min_withdraw_price)}원 입니다.`, false)
            }
            let mother_account = await getMotherDeposit(decode_dns);
            if (withdraw_amount > mother_account?.real_amount) {
                return response(req, res, -100, "출금 요청금이 모계좌잔액보다 많습니다.", false)
            }
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
            let api_withdraw_request_result = await corpApi.user.withdraw.request({
                pay_type: 'withdraw',
                dns_data: decode_dns,
                decode_user: user,
                guid: virtual_account?.guid,
                amount: withdraw_amount,
            })
            if (api_withdraw_request_result.code != 100) {
                return response(req, res, -100, (api_withdraw_request_result?.message || "서버 에러 발생"), api_withdraw_request_result?.data)
            }
            deposit_obj['trx_id'] = api_withdraw_request_result.data?.tid;
            let result = await insertQuery(`${table_name}`, deposit_obj);
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
            let api_withdraw_request_result = await corpApi.user.withdraw.request({
                pay_type: 'deposit',
                dns_data: decode_dns,
                decode_user: {},
                guid: data?.brand?.guid,
                amount: withdraw_amount,
            })
            if (api_withdraw_request_result.code != 100) {
                return response(req, res, -100, (api_withdraw_request_result?.message || "서버 에러 발생"), api_withdraw_request_result?.data)
            }
            deposit_obj['trx_id'] = api_withdraw_request_result.data?.tid;
            let result = await insertQuery(`${table_name}`, deposit_obj);

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
    let sum_sql = `SELECT ${sum_columns.join()} FROM deposits WHERE brand_id=${decode_dns?.id}`;
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
    data['real_amount'] = real_amount.data?.bal_tot_amt ?? 0;

    return data;
}
export default withdrawCtrl;
