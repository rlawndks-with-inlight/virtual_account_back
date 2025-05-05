'use strict';
import axios from "axios";
import corpApi from "../utils.js/corp-util/index.js";
import { checkIsManagerUrl, differenceSecondTwoDate, returnMoment } from "../utils.js/function.js";
import { deleteQuery, getSelectQuery, insertQuery, makeSearchQuery, makeSearchQueryExact, selectQuerySimple, updateQuery } from "../utils.js/query-util.js";
import { checkDns, checkLevel, generateRandomString, isItemBrandIdSameDnsId, lowLevelException, response, settingFiles } from "../utils.js/util.js";
import 'dotenv/config';
import when from "when";
import { readPool } from "../config/db-pool.js";
import redisCtrl from "../redis/index.js";
const table_name = 'virtual_accounts';

const virtualAccountCtrl = {
    list: async (req, res, next) => {
        try {
            let is_manager = await checkIsManagerUrl(req);
            const decode_user = await checkLevel(req.cookies.token, 10, req);
            const decode_dns = checkDns(req.cookies.dns);
            if (!decode_user) {
                return lowLevelException(req, res);
            }
            const { mcht_id, status, search } = req.query;
            let search_columns = [
                `mchts.user_name`,
                `mchts.nickname`,
                `${table_name}.deposit_acct_num`,
                `${table_name}.deposit_acct_name`,
                `${table_name}.guid`,
                `${table_name}.virtual_acct_num`,
                `${table_name}.virtual_user_name`,
                `${table_name}.phone_num`,
            ]
            let columns = [
                `${table_name}.*`,
                `mchts.user_name`,
                `mchts.nickname`,
            ]
            if (decode_dns?.deposit_process_type == 1) {
                columns = [
                    ...columns,
                    `(SELECT SUM(amount) FROM deposits WHERE created_at >= '${returnMoment().substring(0, 10)} 00:00:00' AND created_at <= '${returnMoment().substring(0, 10)} 23:59:59' AND virtual_account_id=${table_name}.id AND deposit_status=0) AS daily_deposit_amount`
                ]
            }
            let sql = `SELECT ${process.env.SELECT_COLUMN_SECRET} FROM ${table_name} `;
            sql += ` LEFT JOIN users AS mchts ON ${table_name}.mcht_id=mchts.id `;
            sql += ` WHERE ${table_name}.brand_id=${decode_dns?.id} `;

            if (mcht_id > 0 || decode_user?.level == 10) {
                sql += ` AND ${table_name}.mcht_id=${mcht_id || decode_user?.id} `;
            }
            if (status) {
                sql += ` AND ${table_name}.status=${status} `
            }
            if (search) {
                sql += makeSearchQueryExact(search_columns, search);
            }
            let data = await getSelectQuery(sql, columns, req.query, [], decode_user, decode_dns);

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
            const { ci } = req.query;
            let values = [];
            let sql = ` SELECT ${table_name}.*, users.mid FROM ${table_name} `;
            sql += ` LEFT JOIN users ON ${table_name}.mcht_id=users.id `;
            if (id > 0) {
                sql += ` WHERE ${table_name}.id=? `;
                values.push(id)
            } else if (ci) {
                sql += ` WHERE ${table_name}.ci=? `;
                values.push(ci)
            }
            sql += ` AND ${table_name}.is_delete=0 `;
            let data = await readPool.query(sql, values)
            data = data[0][0];
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
            const decode_user = await checkLevel(req.cookies.token, 0, req);
            const decode_dns = checkDns(req.cookies.dns);
            const {
                mid, tid, guid,
                vrf_word
            } = req.body;
            let files = settingFiles(req.files);

            let { data: result } = await axios.post(`${process.env.API_URL}/api/virtual-account/check`, {
                mid,
                tid,
                vrf_word,
                guid
            })
            if (result?.result > 0) {
                return response(req, res, 100, "success", result?.data)
            } else {
                return response(req, res, result?.result, result?.message, {})
            }
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
            if (!decode_user) {
                return lowLevelException(req, res);
            }
            let obj = {
            };

            let result = await updateQuery(`${table_name}`, obj, id);

            return response(req, res, 100, "success", {})
        } catch (err) {
            console.log(err)
            return response(req, res, -200, "서버 에러 발생", false)
        } finally {

        }
    },
    getBalance: async (req, res, next) => {
        try {
            let is_manager = await checkIsManagerUrl(req);
            const decode_user = await checkLevel(req.cookies.token, 0, req);
            const decode_dns = checkDns(req.cookies.dns);
            const { id } = req.params;
            const { want_move } = req.query;
            console.log(req.query)
            let virtual_account = await readPool.query(`SELECT * FROM ${table_name} WHERE id=${id}`);
            virtual_account = virtual_account[0][0];
            let dns_data = await readPool.query(`SELECT * FROM brands WHERE id=${decode_dns?.id}`);
            dns_data = dns_data[0][0];

            let user_amount = await corpApi.balance.info({
                pay_type: 'withdraw',
                dns_data: decode_dns,
                decode_user,
                guid: virtual_account?.guid,
            })
            let amount = user_amount.data?.amount ?? 0

            return response(req, res, 100, "success", {
                amount
            })
        } catch (err) {
            console.log(err)
            return response(req, res, -200, "서버 에러 발생", false)
        } finally {

        }
    },
    getStatus: async (req, res, next) => {
        try {
            let is_manager = await checkIsManagerUrl(req);
            const decode_user = await checkLevel(req.cookies.token, 0, req);
            const decode_dns = checkDns(req.cookies.dns);
            const { id } = req.params;
            let virtual_account = await readPool.query(`SELECT * FROM ${table_name} WHERE id=${id}`);
            virtual_account = virtual_account[0][0];
            let dns_data = await readPool.query(`SELECT * FROM brands WHERE id=${decode_dns?.id}`);
            dns_data = dns_data[0][0];

            let api_result = await corpApi.vaccount_info({
                pay_type: 'deposit',
                dns_data: decode_dns,
                decode_user,
                guid: virtual_account?.guid,
            })
            console.log(api_result)
            let status = (api_result.data?.virtual_acct_num == virtual_account?.virtual_acct_num && api_result.data?.status == 0) ? 0 : 1;
            return response(req, res, 100, "success", {
                status
            })
        } catch (err) {
            console.log(err)
            return response(req, res, -200, "서버 에러 발생", false)
        } finally {

        }
    },
    moveMother: async (req, res, next) => {
        try {
            let is_manager = await checkIsManagerUrl(req);
            const decode_user = await checkLevel(req.cookies.token, 0, req);
            const decode_dns = checkDns(req.cookies.dns);
            const { id } = req.body;
            let virtual_account = await readPool.query(`SELECT * FROM ${table_name} WHERE id=${id}`);
            virtual_account = virtual_account[0][0];
            let dns_data = await readPool.query(`SELECT * FROM brands WHERE id=${decode_dns?.id}`);
            dns_data = dns_data[0][0];

            let user_amount = await corpApi.balance.info({
                pay_type: 'withdraw',
                dns_data: decode_dns,
                decode_user,
                guid: virtual_account?.guid,
            })
            let amount = user_amount.data?.amount ?? 0
            if (amount > 0) {
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
                    virtual_account_id: virtual_account?.id,
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
            return response(req, res, 100, "success", {})
        } catch (err) {
            console.log(err)
            return response(req, res, -200, "서버 에러 발생", false)
        } finally {

        }
    },
    remove: async (req, res, next) => {
        try {
            const decode_user = await checkLevel(req.cookies?.token, 10, req);
            let decode_dns = checkDns(req.cookies?.dns);
            if (!decode_dns) {
                decode_dns = req.dns_data;
            }
            const { id } = req.params;
            let virtual_account = await readPool.query(`SELECT * FROM ${table_name} WHERE id=${id}`);
            virtual_account = virtual_account[0][0];
            let dns_data = await readPool.query(`SELECT * FROM brands WHERE id=${decode_dns?.id}`);
            dns_data = dns_data[0][0];
            if (virtual_account?.mcht_id != decode_user?.id && decode_user?.level < 40) {
                return lowLevelException(req, res);
            }
            let user_amount = await corpApi.balance.info({
                pay_type: 'withdraw',
                dns_data: decode_dns,
                decode_user,
                guid: virtual_account?.guid,
            })
            let amount = user_amount.data?.amount ?? 0
            if (amount > 0 && dns_data?.withdraw_corp_type != 7 && dns_data?.withdraw_corp_type != 6) {
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
                    virtual_account_id: virtual_account?.id,
                    amount,
                    expect_amount: amount,
                    deposit_bank_code: virtual_account?.deposit_bank_code,
                    deposit_acct_num: virtual_account?.deposit_acct_num,
                    deposit_acct_name: virtual_account?.deposit_acct_name,
                    pay_type: 15,
                    trx_id: mother_to_result.data?.tid ?? "",
                };
                let result = await insertQuery(`deposits`, obj);
            }
            if ((virtual_account?.virtual_acct_num && virtual_account?.delete_step < 1 && virtual_account?.status == 0) ||
                (virtual_account?.delete_step < 1 && dns_data?.withdraw_corp_type == 7)) {
                let api_result_vaccount_delete = await corpApi.vaccount_delete({
                    pay_type: 'deposit',
                    dns_data: decode_dns,
                    decode_user,
                    guid: virtual_account?.guid,
                    ci: virtual_account?.ci,
                    bank_id: virtual_account?.virtual_bank_code,
                    virtual_acct_num: virtual_account?.virtual_acct_num,
                    phone_num: virtual_account?.phone_num,
                    bank_code: virtual_account?.deposit_bank_code,
                    acct_num: virtual_account?.deposit_acct_num,
                    name: virtual_account?.deposit_acct_name,
                })

                console.log('1:' + api_result_vaccount_delete);
                if (api_result_vaccount_delete?.code != 100) {
                    return response(req, res, -100, (api_result_vaccount_delete?.message || "서버 에러 발생"), false)
                }
                let result = await updateQuery(`${table_name}`, {
                    delete_step: 1,
                }, id)
            }

            // if (api_result.code != 100 && api_result?.message != '가상계좌 해지 불가 상태') {
            //     return response(req, res, -100, (api_result?.message || "서버 에러 발생"), false)
            // }
            if (virtual_account?.deposit_acct_num && virtual_account?.delete_step < 2) {
                await new Promise((r) => setTimeout(r, 1000));
                let api_result_account_delete = await corpApi.user.account_delete({
                    pay_type: 'deposit',
                    dns_data: decode_dns,
                    decode_user,
                    guid: virtual_account?.guid,
                    bank_id: virtual_account?.deposit_bank_code,
                    deposit_acct_num: virtual_account?.deposit_acct_num,
                    ci: virtual_account?.ci,
                })
                if (api_result_account_delete?.code != 100) {
                    return response(req, res, -100, (api_result_account_delete?.message || "서버 에러 발생"), false)
                }
                let result = await updateQuery(`${table_name}`, {
                    delete_step: 2,
                }, id)
            }

            // if (api_result.code != 100 && api_result.message != '출금계좌 불일치로 진행 불가') {
            //     return response(req, res, -100, (api_result?.message || "서버 에러 발생"), false)
            // }
            if (virtual_account?.guid && virtual_account?.delete_step < 3) {
                await new Promise((r) => setTimeout(r, 1000));
                let delete_user = await corpApi.user.remove({
                    pay_type: 'deposit',
                    dns_data: decode_dns,
                    decode_user,
                    guid: virtual_account?.guid,
                })
                console.log('3:' + delete_user);
                // if (delete_user?.code != 100) {
                //     return response(req, res, -100, (delete_user?.message || "서버 에러 발생"), false)
                // }
                let result = await updateQuery(`${table_name}`, {
                    delete_step: 3,
                }, id)
            }

            let result1 = await updateQuery(`users`, {
                virtual_account_id: 0,
            }, id, 'virtual_account_id')
            let result2 = await updateQuery(`brands`, {
                virtual_account_id: 0,
            }, id, 'virtual_account_id')
            let result3 = await deleteQuery(`${table_name}`, {
                id
            })
            return response(req, res, 100, "success", {})
        } catch (err) {
            console.log(err)
            return response(req, res, -200, "서버 에러 발생", false)
        } finally {

        }
    },
    removeAllByMcht: async (req, res, next) => {
        try {
            let is_manager = await checkIsManagerUrl(req);
            const decode_user = await checkLevel(req.cookies.token, 40, req);
            const decode_dns = checkDns(req.cookies.dns);
            console.log(req.params)
            const {
                id
            } = req.params;
            if (!decode_user) {
                return lowLevelException(req, res);
            }
            let virtual_accounts = await readPool.query(`SELECT id FROM virtual_accounts WHERE mcht_id=${id} AND brand_id=${decode_dns?.id} AND is_delete=0`);
            virtual_accounts = virtual_accounts[0];
            let result_list = [];
            for (var i = 0; i < virtual_accounts.length; i++) {
                result_list.push(virtualAccountCtrl.remove({ ...req, params: { id: virtual_accounts[i]?.id, IS_RETURN: true } }, res));
            }
            for (var i = 0; i < result_list.length; i++) {
                await result_list[i];
            }
            let result = (await when(result_list));

            return response(req, res, 100, "success", {})
        } catch (err) {
            console.log(err)
            return response(req, res, -200, "서버 에러 발생", false)
        } finally {

        }
    },
    changeVirtualUserName: async (req, res, next) => {
        try {
            let is_manager = await checkIsManagerUrl(req);
            const decode_user = await checkLevel(req.cookies.token, 10, req);
            const decode_dns = checkDns(req.cookies.dns);
            const {
                virtual_account_id, virtual_user_name,
            } = req.body;
            if (!decode_user) {
                return lowLevelException(req, res);
            }
            let result = await updateQuery(`${table_name}`, {
                virtual_user_name
            }, virtual_account_id)
            return response(req, res, 100, "success", {})
        } catch (err) {
            console.log(err)
            return response(req, res, -200, "서버 에러 발생", false)
        } finally {

        }
    },
    connectMcht: async (req, res, next) => {//가맹점과 매칭
        try {
            let is_manager = await checkIsManagerUrl(req);
            const decode_user = await checkLevel(req.cookies.token, 40, req);
            const decode_dns = checkDns(req.cookies.dns);
            if (!decode_user) {
                return lowLevelException(req, res);
            }
            let table = decode_dns?.deposit_type == 'virtual_account' ? 'virtual_account' : 'member'
            const {
                virtual_account_id,
                mcht_id,
            } = req.body;
            let virtual_account = await readPool.query(`SELECT * FROM ${table}s WHERE brand_id=${decode_dns?.id} AND id=${virtual_account_id}`);
            virtual_account = virtual_account[0][0];
            if (!virtual_account) {
                return response(req, res, -100, "정보가 존재하지 않습니다.", false)
            }
            let mcht = await readPool.query(`SELECT * FROM users WHERE level=10 AND brand_id=${decode_dns?.id} AND id=?`, [
                mcht_id,
            ]);
            mcht = mcht[0][0];
            if (!mcht) {
                return response(req, res, -100, "존재하지 않는 가맹점 입니다.", false)
            }
            let result = await updateQuery(`${table}s`, {
                mcht_id: mcht?.id,
            }, virtual_account_id);

            return response(req, res, 100, "success", {})
        } catch (err) {
            console.log(err)
            return response(req, res, -200, "서버 에러 발생", false)
        } finally {

        }
    },
    requestDeposit: async (req, res, next) => {
        try {
            let is_manager = await checkIsManagerUrl(req);
            const decode_user = await checkLevel(req.cookies.token, 10, req);
            const decode_dns = checkDns(req.cookies.dns);
            const {
                virtual_account_id, amount,
            } = req.body;
            if (!(amount > 0)) {
                return response(req, res, -100, "입금예정액은 0원보다 커야합니다.", false)
            }
            if (amount > 2000000) {
                return response(req, res, -100, "입금예정액이 너무 큽니다.", false)
            }
            let is_ing_request_deposit = await redisCtrl.addNumber(`is_ing_request_deposit_${virtual_account_id}`, 1, 30);
            if (is_ing_request_deposit > 1) {
                return response(req, res, -100, "30초 뒤에 실행해 주세요.", false);
            }
            let virtual_account = await readPool.query(`SELECT * FROM ${table_name} WHERE id=${virtual_account_id} AND is_delete=0 AND status=0`);
            virtual_account = virtual_account[0][0];
            if (!virtual_account) {
                await redisCtrl.delete(`is_ing_request_deposit_${virtual_account_id}`);
                return response(req, res, -100, '입금불가 가상계좌 입니다.', false);
            }
            if (virtual_account?.last_auth_date.substring(0, 10) != returnMoment().substring(0, 10)) {
                return response(req, res, -100, "데일리 인증을 완료해 주세요.", false)
            }
            if (!(differenceSecondTwoDate(returnMoment(), virtual_account?.last_acct_auth_date) < 300 && virtual_account?.last_acct_auth_date)) {
                return response(req, res, -100, "5분 계좌인증을 완료해 주세요.", false)
            }
            let mcht = await readPool.query(`SELECT virtual_acct_link_status, is_delete FROM users WHERE id=${virtual_account?.mcht_id}`);
            mcht = mcht[0][0];
            if ((mcht?.virtual_acct_link_status ?? 0) != 0 || mcht?.is_delete == 1) {
                await redisCtrl.delete(`is_ing_request_deposit_${virtual_account_id}`);
                return response(req, res, -100, "입금 불가한 가맹점 입니다.", false)
            }
            let is_exist_not_confirm_deposit = await readPool.query(`SELECT id FROM deposits WHERE virtual_account_id=${virtual_account_id} AND deposit_status=5 AND is_delete=0 AND created_at >= NOW() - INTERVAL 70 MINUTE`);
            is_exist_not_confirm_deposit = is_exist_not_confirm_deposit[0][0];
            if (is_exist_not_confirm_deposit) {
                await redisCtrl.delete(`is_ing_request_deposit_${virtual_account_id}`);
                return response(req, res, -100, "아직 처리되지 않은 건이 있습니다.", false)
            }
            let trx_id = `${decode_dns?.id}${decode_user?.id ?? generateRandomString(6)}${new Date().getTime()}`;
            let result = await insertQuery(`deposits`, {
                brand_id: decode_dns?.id,
                mcht_id: virtual_account?.mcht_id,
                virtual_account_id: virtual_account_id,
                expect_amount: amount,
                trx_id,
                deposit_status: 20,
                pay_type: 0,
            })
            let api_result = undefined;
            if (decode_dns?.deposit_process_type == 0) {
                api_result = await corpApi.deposit.request({
                    pay_type: 'deposit',
                    dns_data: decode_dns,
                    ci: virtual_account?.ci,
                    amount,
                    trx_id,
                    name: virtual_account?.deposit_acct_name,
                });
            } else if (decode_dns?.deposit_process_type == 1) {
                api_result = await corpApi.deposit.charge({
                    pay_type: 'deposit',
                    dns_data: decode_dns,
                    ci: virtual_account?.ci,
                    amount,
                    trx_id,
                    name: virtual_account?.deposit_acct_name,
                });
            }

            if (api_result?.code != 100) {
                await redisCtrl.delete(`is_ing_request_deposit_${virtual_account_id}`);
                return response(req, res, -100, (api_result?.message || "서버 에러 발생"), false)
            }
            let result2 = await updateQuery(`deposits`, {
                deposit_status: 5
            }, result?.insertId)
            return response(req, res, 100, "success", {})
        } catch (err) {
            console.log(err)
            return response(req, res, -200, "서버 에러 발생", false)
        } finally {

        }
    },
    cancelDeposit: async (req, res, next) => {
        try {
            let is_manager = await checkIsManagerUrl(req);
            const decode_user = await checkLevel(req.cookies.token, 10, req);
            const decode_dns = checkDns(req.cookies.dns);
            if (!decode_user) {
                return lowLevelException(req, res);
            }
            const {
                id,
            } = req.body;
            let trx = await readPool.query(`SELECT * FROM deposits WHERE id=${id} AND brand_id=${decode_dns?.id}`);
            trx = trx[0][0];
            if (!trx) {
                return response(req, res, -100, "존재하지 않는 거래건 입니다.", false)
            }
            if (trx?.deposit_status == 0) {
                return response(req, res, -100, "이미 완료된 건입니다.", false)
            }
            let cancel_trx_id = `cancel${decode_dns?.id}${decode_user?.id ?? generateRandomString(6)}${new Date().getTime() % 1000000}`;
            let update_obj = {
                is_delete: 1,
                cancel_trx_id: cancel_trx_id,
            }
            if (trx?.deposit_status == 5) {
                let api_result = await corpApi.deposit.cancel({
                    pay_type: 'deposit',
                    dns_data: decode_dns,
                    trx_id: trx?.trx_id,
                    cancel_trx_id,
                });
                if (api_result?.code != 100) {
                    if (api_result?.data?.is_not_exist_deposit == 1) {
                        update_obj['deposit_status'] = 20;
                        delete update_obj['cancel_trx_id']
                    } else {
                        return response(req, res, -100, (api_result?.message || "서버 에러 발생"), false)
                    }
                }
            } else if (trx?.deposit_status == 20) {
                delete update_obj['cancel_trx_id'];
            }
            let result2 = await updateQuery(`deposits`, update_obj, id)
            return response(req, res, 100, "success", {})
        } catch (err) {
            console.log(err)
            return response(req, res, -200, "서버 에러 발생", false)
        } finally {

        }
    },
    exist_check: async (req, res, next) => {
        try {
            const decode_dns = checkDns(req.cookies.dns);
            console.log(decode_dns)
            const {
                name,
                phone_num,
                birth,
            } = req.body;
            let virtual_account = await readPool.query(`SELECT id FROM ${table_name} WHERE brand_id=${decode_dns?.id} AND phone_num=? AND deposit_acct_name=?`, [phone_num, name]);
            virtual_account = virtual_account[0][0];
            if (virtual_account) {

            } else {

            }
            let remain_virtual_account = await corpApi.vaccount_get({
                pay_type: 'deposit',
                dns_data: decode_dns,
            })
            if (remain_virtual_account?.code > 0) {
                return response(req, res, 100, "success", remain_virtual_account?.data);
            } else {
                return response(req, res, -100, remain_virtual_account?.message, false)
            }
        } catch (err) {
            console.log(err)
            return response(req, res, -200, "서버 에러 발생", false)
        } finally {

        }
    },
    changeStatus: async (req, res, next) => {
        try {
            let is_manager = await checkIsManagerUrl(req);
            const decode_user = await checkLevel(req.cookies.token, 40, req);
            const decode_dns = checkDns(req.cookies.dns);
            if (!decode_user) {
                return lowLevelException(req, res);
            }
            const { id } = req.params
            let { status } = req.body;
            let virtual_account = await selectQuerySimple(table_name, id);
            virtual_account = virtual_account[0];
            let obj = {
                status
            }
            let result = await updateQuery(`${table_name}`, obj, id);
            return response(req, res, 100, "success", {})
        } catch (err) {
            console.log(err)
            return response(req, res, -200, "서버 에러 발생", false)
        } finally {

        }
    },
    dailyAuthRequest: async (req, res, next) => {
        try {
            let is_manager = await checkIsManagerUrl(req);
            const decode_user = await checkLevel(req.cookies.token, 0, req);
            const decode_dns = checkDns(req.cookies.dns);
            const {
                id,
            } = req.body;
            let virtual_account = await readPool.query(`SELECT * FROM ${table_name} WHERE id=? AND brand_id=? AND status=0 AND is_delete=0 `, [id, decode_dns?.id]);
            virtual_account = virtual_account[0][0];
            if (!virtual_account) {
                return response(req, res, -100, "잘못된 접근입니다.", false)
            }
            if (virtual_account?.last_auth_date.substring(0, 10) == returnMoment().substring(0, 10)) {
                return response(req, res, -100, "이미 금일 인증이 완료 되었습니다.", false)
            }
            let api_result = await corpApi.sms.push({
                dns_data: decode_dns,
                pay_type: 'deposit',
                decode_user: {},
                ci: virtual_account?.ci,
                birth: virtual_account?.birth,
                name: virtual_account?.deposit_acct_name,
                gender: virtual_account?.gender,
                ntv_frnr: virtual_account?.ntv_frnr,
                tel_com: virtual_account?.tel_com,
                phone_num: virtual_account?.phone_num,
                recert_yn: 'Y',
            })
            if (api_result?.code != 100) {
                return response(req, res, -100, (api_result?.message || "서버 에러 발생"), false)
            }
            let result = await updateQuery(table_name, {
                last_auth_request_date: returnMoment(),
            }, id);
            return response(req, res, 100, "success", { ...api_result?.data })
        } catch (err) {
            console.log(err)
            return response(req, res, -200, "서버 에러 발생", false)
        } finally {

        }
    },
    dailyAuthCheck: async (req, res, next) => {
        try {
            let is_manager = await checkIsManagerUrl(req);
            const decode_user = await checkLevel(req.cookies.token, 0, req);
            const decode_dns = checkDns(req.cookies.dns);
            const {
                vrf_word,
                tid,
                id,
            } = req.body;
            let virtual_account = await readPool.query(`SELECT * FROM ${table_name} WHERE id=? AND brand_id=? AND status=0 AND is_delete=0 `, [id, decode_dns?.id]);
            virtual_account = virtual_account[0][0];
            if (!virtual_account) {
                return response(req, res, -100, "잘못된 접근입니다.", false)
            }
            if (virtual_account?.last_auth_date.substring(0, 10) == returnMoment().substring(0, 10)) {
                return response(req, res, -100, "이미 금일 인증이 완료 되었습니다.", false)
            }
            let api_result = await corpApi.sms.check({
                dns_data: decode_dns,
                pay_type: 'deposit',
                decode_user: {},
                phone_num: virtual_account?.phone_num,
                ci: virtual_account?.ci,
                vrf_word,
                tid,
                recert_yn: 'Y',
            })
            if (api_result?.code != 100) {
                return response(req, res, -100, (api_result?.message || "서버 에러 발생"), false)
            }
            let auth_history = await insertQuery('auth_histories', {
                mcht_id: virtual_account?.mcht_id,
                acct_num: virtual_account?.phone_num,
                brand_id: decode_dns?.id,
                auth_type: 0,
            });
            let result = await updateQuery(table_name, {
                last_auth_date: returnMoment(),
            }, id);
            return response(req, res, 100, "success", {})
        } catch (err) {
            console.log(err)
            return response(req, res, -200, "서버 에러 발생", false)
        } finally {

        }
    },
    acctAuthRequest: async (req, res, next) => {
        try {
            let is_manager = await checkIsManagerUrl(req);
            const decode_user = await checkLevel(req.cookies.token, 0, req);
            const decode_dns = checkDns(req.cookies.dns);
            const {
                id,
            } = req.body;
            let virtual_account = await readPool.query(`SELECT * FROM ${table_name} WHERE id=? AND brand_id=? AND status=0 AND is_delete=0 `, [id, decode_dns?.id]);
            virtual_account = virtual_account[0][0];
            if (!virtual_account) {
                return response(req, res, -100, "잘못된 접근입니다.", false)
            }
            if (differenceSecondTwoDate(returnMoment(), virtual_account?.last_acct_auth_date) < 300 && virtual_account?.last_acct_auth_date) {
                return response(req, res, -100, "이미 5분 인증이 완료 되었습니다.", false)
            }

            if (virtual_account?.user_type == 0) {
                let is_exist_account = await corpApi.account.info({
                    pay_type: 'deposit',
                    dns_data: decode_dns,
                    ci: virtual_account?.ci,
                    bank_code: virtual_account?.deposit_bank_code,
                    acct_num: virtual_account?.deposit_acct_num,
                    name: virtual_account?.deposit_acct_name,
                    business_num: virtual_account?.business_num,
                    user_type: virtual_account?.user_type,
                    recert_yn: 'Y',
                })
                if (is_exist_account?.code != 100) {
                    return response(req, res, -110, (is_exist_account?.message || "서버 에러 발생"), false)
                }
            }


            let api_result = await corpApi.user.account_({
                dns_data: decode_dns,
                pay_type: 'deposit',
                decode_user: {},
                ci: virtual_account?.ci,
                bank_code: virtual_account?.deposit_bank_code,
                acct_num: virtual_account?.deposit_acct_num,
                name: virtual_account?.deposit_acct_name,
                business_num: virtual_account?.business_num,
                user_type: virtual_account?.user_type,
                recert_yn: 'Y',
            })
            if (api_result?.code != 100) {
                return response(req, res, -120, (api_result?.message || "서버 에러 발생"), false)
            }
            let auth_history = await insertQuery('auth_histories', {
                mcht_id: virtual_account?.mcht_id,
                acct_num: virtual_account?.deposit_acct_num,
                brand_id: decode_dns?.id,
                auth_type: 1,
            });
            let result = await updateQuery(table_name, {
                last_acct_auth_request_date: returnMoment(),
            }, id);
            return response(req, res, 100, "success", { ...api_result?.data })
        } catch (err) {
            console.log(err)
            return response(req, res, -200, "서버 에러 발생", false)
        } finally {

        }
    },
    acctAuthcheck: async (req, res, next) => {
        try {
            let is_manager = await checkIsManagerUrl(req);
            const decode_user = await checkLevel(req.cookies.token, 0, req);
            const decode_dns = checkDns(req.cookies.dns);
            const {
                vrf_word,
                tid,
                date,
                id,
            } = req.body;
            let virtual_account = await readPool.query(`SELECT * FROM ${table_name} WHERE id=? AND brand_id=? AND status=0 AND is_delete=0 `, [id, decode_dns?.id]);
            virtual_account = virtual_account[0][0];
            if (!virtual_account) {
                return response(req, res, -100, "잘못된 접근입니다.", false)
            }
            if (differenceSecondTwoDate(returnMoment(), virtual_account?.last_acct_auth_date) < 300 && virtual_account?.last_acct_auth_date) {
                return response(req, res, -100, "이미 5분 인증이 완료 되었습니다.", false)
            }
            let api_result = await corpApi.user.account_verify({
                dns_data: decode_dns,
                pay_type: 'deposit',
                decode_user: {},
                ci: virtual_account?.ci,
                bank_code: virtual_account?.deposit_bank_code,
                acct_num: virtual_account?.deposit_acct_num,
                tid: tid,
                vrf_word: vrf_word,
                recert_yn: 'Y',
                date,
            })
            if (api_result?.code != 100) {
                return response(req, res, -100, (api_result?.message || "서버 에러 발생"), false)
            }
            let result = await updateQuery(table_name, {
                last_acct_auth_date: returnMoment(),
            }, id);
            return response(req, res, 100, "success", {})
        } catch (err) {
            console.log(err)
            return response(req, res, -200, "서버 에러 발생", false)
        } finally {

        }
    },
};

export default virtualAccountCtrl;
