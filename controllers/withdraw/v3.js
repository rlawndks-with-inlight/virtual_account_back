'use strict';
import _ from "lodash";
import corpApi from "../../utils.js/corp-util/index.js";
import { checkIsManagerUrl, getUserWithDrawFee, returnMoment } from "../../utils.js/function.js";
import { deleteQuery, getSelectQuery, insertQuery, selectQuerySimple, updateQuery } from "../../utils.js/query-util.js";
import { checkDns, checkLevel, commarNumber, findBlackList, getDailyWithdrawAmount, getMotherDeposit, getOperatorList, getReqIp, isItemBrandIdSameDnsId, operatorLevelList, settingFiles } from "../../utils.js/util.js";
import 'dotenv/config';
import crypto from 'crypto';
import speakeasy from 'speakeasy';
import redisCtrl from "../../redis/index.js";
import { readPool } from "../../config/db-pool.js";
//코리아결제출금

export const makeSignValueSha256 = (text) => {
    let api_sign_val = crypto.createHash('sha256').update(text).digest('hex');
    return api_sign_val;
}
const response = (req, res, result, message, data) => {
    return {
        req, res, result, message, data
    }
}
const withdrawV3Ctrl = {
    check: async (req_, res, next) => {//발급요청
        let req = req_;
        try {
            let {
                api_key,
                mid,
                withdraw_bank_code,
                withdraw_acct_num,
                birth,
                business_num,
                user_type = 0,
                is_manager,
                user_id,
            } = req.body;

            let dns_data = await readPool.query(`SELECT * FROM brands WHERE api_key=?`, [api_key]);
            dns_data = dns_data[0][0];
            if (!dns_data) {
                return response(req, res, -100, "api key가 잘못되었습니다.", false);
            }
            req.body.brand_id = dns_data?.id;
            let user = {};
            if (is_manager) {
                user = await readPool.query(`SELECT * FROM users WHERE id=${user_id}`);
                user = user[0][0];
            } else {
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
                mcht_sql += ` WHERE users.mid=? AND users.brand_id=? `;
                mcht_sql = mcht_sql.replace(process.env.SELECT_COLUMN_SECRET, mcht_columns.join())
                user = await readPool.query(mcht_sql, [mid, dns_data?.id]);
                user = user[0][0];
            }
            /*
            if (user_id == 241) {
                console.log(req)
            }
            let requestIp = getReqIp(req);
            let ip_list = await readPool.query(`SELECT * FROM permit_ips WHERE user_id=${user?.id} AND is_delete=0`);
            ip_list = ip_list[0];
            if (user?.level < 40 && (!ip_list.map(itm => { return itm?.ip }).includes(requestIp)) && ip_list.length > 0) {
                return response(req, res, -150, "ip 권한이 없습니다.", {})
            }
            */

            let account_info = await corpApi.account.info({
                pay_type: 'withdraw',
                dns_data: dns_data,
                decode_user: user,
                bank_code: withdraw_bank_code,
                acct_num: withdraw_acct_num,
                birth,
                business_num,
                user_type,
                amount: 1000,
            })
            if (account_info.code == 100) {
                return response(req, res, 100, "success", account_info.data)
            } else {
                return response(req, res, -100, (account_info?.message || "서버 에러 발생"), false)
            }

        } catch (err) {
            console.log(err)
            return response(req, res, -200, "서버 에러 발생", false)
        } finally {

        }
    },
    request: async (req_, res, next) => {
        let req = req_;
        try {
            let {
                api_key,
                mid,
                guid,
                withdraw_amount,
                pay_type = 'withdraw',
                note = "",
                api_sign_val,
                otp_num,
                withdraw_bank_code,
                withdraw_acct_num,
                withdraw_acct_name,
                identity = "",
            } = req.body;
            let is_ing_withdraw = await redisCtrl.addNumber(`is_ing_withdraw_${mid}_${withdraw_acct_num}`, 1, 60);
            if (is_ing_withdraw > 1) {
                return response(req, res, -100, "같은 건으로 출금신청 진행중인 건이 존재합니다. 출금 내역을 확인해 주세요.", {});
            }
            if (!(withdraw_amount > 0)) {
                await redisCtrl.delete(`is_ing_withdraw_${mid}_${withdraw_acct_num}`);
                return response(req, res, -100, "출금금액은 0보다 커야합니다.", {});
            }
            withdraw_amount = parseInt(withdraw_amount);
            if (!api_key) {
                await redisCtrl.delete(`is_ing_withdraw_${mid}_${withdraw_acct_num}`);
                return response(req, res, -100, "api key를 입력해주세요.", {});
            }
            if (!mid) {
                await redisCtrl.delete(`is_ing_withdraw_${mid}_${withdraw_acct_num}`);
                return response(req, res, -100, "mid를 입력해주세요.", {});
            }
            let dns_data = await redisCtrl.get(`dns_data_${api_key}`);
            if (dns_data) {
                dns_data = JSON.parse(dns_data ?? "{}");
            } else {
                dns_data = await readPool.query(`SELECT * FROM brands WHERE api_key=?`, [api_key]);
                dns_data = dns_data[0][0];
                await redisCtrl.set(`dns_data_${api_key}`, JSON.stringify(dns_data), 60);
            }


            if (!dns_data) {
                await redisCtrl.delete(`is_ing_withdraw_${mid}_${withdraw_acct_num}`);
                return response(req, res, -100, "api key가 잘못되었습니다.", {});
            }
            dns_data['setting_obj'] = JSON.parse(dns_data?.setting_obj ?? '{}');
            req.body.brand_id = dns_data?.id;
            let pay_type_name = '';
            if (pay_type == 'withdraw') {
                pay_type_name = '출금';
                pay_type = 5;
            } else if (pay_type == 'return') {
                pay_type_name = '반환';
                pay_type = 20;
            } else {
                await redisCtrl.delete(`is_ing_withdraw_${mid}_${withdraw_acct_num}`);
                return response(req, res, -100, "결제타입에러", false)
            }

            let user_column = [
                `users.*`,
            ]
            let user = await readPool.query(`SELECT ${user_column.join()} FROM users WHERE mid=? AND brand_id=${dns_data?.id} AND is_delete=0`, [
                mid
            ]);
            user = user[0][0];
            if (user?.can_return != 1 && pay_type == 20) {
                await redisCtrl.delete(`is_ing_withdraw_${mid}_${withdraw_acct_num}`);
                return response(req, res, -100, "반환 권한이 없습니다.", false)
            }
            if (!user) {
                await redisCtrl.delete(`is_ing_withdraw_${mid}_${withdraw_acct_num}`);
                return response(req, res, -100, "mid가 잘못 되었습니다.", false)
            }

            let requestIp = getReqIp(req);
            let ip_list = await redisCtrl.get(`user_ip_list_${user?.id}`);
            if (ip_list) {
                ip_list = JSON.parse(ip_list ?? "[]")
            } else {
                ip_list = await readPool.query(`SELECT * FROM permit_ips WHERE user_id=${user?.id} AND is_delete=0`);
                ip_list = ip_list[0];
                await redisCtrl.set(`user_ip_list_${user?.id}`, JSON.stringify(ip_list), 60);
            }
            if ((!ip_list.map(itm => { return itm?.ip }).includes(requestIp))) {
                await redisCtrl.delete(`is_ing_withdraw_${mid}_${withdraw_acct_num}`);
                return response(req, res, -150, "ip 권한이 없습니다.", false)
            }
            if (dns_data?.is_use_otp == 1) {
                var verified = speakeasy.totp.verify({
                    secret: user?.otp_token,
                    encoding: 'base32',
                    token: otp_num
                });
                if (!verified) {
                    await redisCtrl.delete(`is_ing_withdraw_${mid}_${withdraw_acct_num}`);
                    return response(req, res, -100, "OTP번호가 잘못되었습니다.", false);
                }
            }
            if (!withdraw_bank_code) {
                await redisCtrl.delete(`is_ing_withdraw_${mid}_${withdraw_acct_num}`);
                return response(req, res, -100, "은행을 선택해 주세요.", false)
            }
            if (!withdraw_acct_num) {
                await redisCtrl.delete(`is_ing_withdraw_${mid}_${withdraw_acct_num}`);
                return response(req, res, -100, "계좌번호를 입력해 주세요.", false)
            }
            if (!withdraw_acct_name) {
                await redisCtrl.delete(`is_ing_withdraw_${mid}_${withdraw_acct_num}`);
                return response(req, res, -100, "예금주명을 입력해 주세요.", false)
            }
            if (dns_data?.is_use_sign_key == 1) {
                let user_api_sign_val = makeSignValueSha256(`${api_key}${mid}${user?.sign_key}`);
                if (user_api_sign_val != api_sign_val) {
                    await redisCtrl.delete(`is_ing_withdraw_${mid}_${withdraw_acct_num}`);
                    return response(req, res, -100, "서명값이 잘못 되었습니다.", false)
                }
            }
            let return_time = returnMoment().substring(11, 16);
            if (dns_data?.setting_obj?.not_withdraw_s_time >= dns_data?.setting_obj?.not_withdraw_e_time) {
                if (return_time >= dns_data?.setting_obj?.not_withdraw_s_time || return_time <= dns_data?.setting_obj?.not_withdraw_e_time) {
                    await redisCtrl.delete(`is_ing_withdraw_${mid}_${withdraw_acct_num}`);
                    return response(req, res, -100, `출금 불가 시간입니다. ${dns_data?.setting_obj?.not_withdraw_s_time} ~ ${dns_data?.setting_obj?.not_withdraw_e_time}`, false);
                }
            } else {
                if (return_time >= dns_data?.setting_obj?.not_withdraw_s_time && return_time <= dns_data?.setting_obj?.not_withdraw_e_time) {
                    await redisCtrl.delete(`is_ing_withdraw_${mid}_${withdraw_acct_num}`);
                    return response(req, res, -100, `출금 불가 시간입니다. ${dns_data?.setting_obj?.not_withdraw_s_time} ~ ${dns_data?.setting_obj?.not_withdraw_e_time}`, false);
                }
            }
            let amount = parseInt(withdraw_amount) + (dns_data?.withdraw_fee_type == 0 ? user?.withdraw_fee : 0);
            if (dns_data?.withdraw_max_price > 0) {
                let date = returnMoment().substring(0, 10);
                let today_withdraw_sum_sql = ` SELECT SUM(amount) AS amount, SUM(withdraw_fee) AS withdraw_fee FROM deposits WHERE brand_id=${dns_data?.id} `;
                today_withdraw_sum_sql += ` AND pay_type IN (5, 10, 20) `;
                today_withdraw_sum_sql += ` AND withdraw_status IN (0) `;
                today_withdraw_sum_sql += ` AND (created_at BETWEEN '${date} 00:00:00' AND '${date} 23:59:59')  `;
                let today_withdraw_sum = await readPool.query(today_withdraw_sum_sql);
                today_withdraw_sum = (today_withdraw_sum[0][0]?.amount ?? 0) * (-1) - (today_withdraw_sum[0][0]?.withdraw_fee ?? 0);
                if (dns_data?.withdraw_max_price < today_withdraw_sum + amount) {
                    await redisCtrl.delete(`is_ing_withdraw_${mid}_${withdraw_acct_num}`);
                    return response(req, res, -100, "출금 실패 B", false)
                }
            }
            if (dns_data?.month_withdraw_max_price > 0) {
                let first_date = returnMoment().substring(0, 10);
                let first_date_list = first_date.split('-');
                first_date = `${first_date_list[0]}-${first_date_list[1]}-01`;
                let month = parseInt(first_date_list[1]);
                let next_year = (month == 12 ? (parseInt(first_date_list[0]) + 1) : parseInt(first_date_list[0]));
                let next_month = (month == 12 ? 1 : (month + 1));

                let month_withdraw_sum_sql = ` SELECT SUM(amount) AS amount, SUM(withdraw_fee) AS withdraw_fee FROM deposits WHERE brand_id=${dns_data?.id} `;
                month_withdraw_sum_sql += ` AND pay_type IN (5, 10, 20) `;
                month_withdraw_sum_sql += ` AND withdraw_status IN (0) `;
                month_withdraw_sum_sql += ` AND (created_at BETWEEN '${first_date} 00:00:00' AND '${next_year}-${next_month >= 10 ? '' : '0'}${next_month}-01 00:00:00')  `;
                let month_withdraw_sum = await readPool.query(month_withdraw_sum_sql);
                month_withdraw_sum = (month_withdraw_sum[0][0]?.amount ?? 0) * (-1) - (month_withdraw_sum[0][0]?.withdraw_fee ?? 0);
                if (dns_data?.month_withdraw_max_price < month_withdraw_sum + amount) {
                    await redisCtrl.delete(`is_ing_withdraw_${mid}_${withdraw_acct_num}`);
                    return response(req, res, -100, "출금 실패 C", false)
                }
            }
            if (user?.level == 10 && dns_data?.setting_obj?.is_use_daily_withdraw == 1 && user?.daily_withdraw_amount > 0) {
                let daliy_withdraw_amount = await getDailyWithdrawAmount(user);
                daliy_withdraw_amount = (daliy_withdraw_amount?.withdraw_amount ?? 0) * (-1);
                if (daliy_withdraw_amount + amount > user?.daily_withdraw_amount) {
                    await redisCtrl.delete(`is_ing_withdraw_${mid}_${withdraw_acct_num}`);
                    return response(req, res, -100, `일일 출금금액을 넘었습니다.\n일일 출금금액:${commarNumber(user?.daily_withdraw_amount)}`, false);
                }
            }
            let black_item = await findBlackList(withdraw_acct_num, 0, dns_data);
            if (black_item) {
                await redisCtrl.delete(`is_ing_withdraw_${mid}_${withdraw_acct_num}`);
                return response(req, res, -100, "블랙리스트 유저입니다.", false);
            }
            /*
            if (pay_type == 20 && user?.can_return_ago_pay == 1) {
                let deposit_count = await readPool.query(`SELECT COUNT(*) AS count FROM deposits WHERE pay_type=0 AND virtual_account_id=${virtual_account?.id}`);
                deposit_count = deposit_count[0][0];
                if (deposit_count?.count < 1) {
                    return response(req, res, -100, "결제한 이력이 없는 유저이므로 반환 불가합니다.", false)
                }
            }
            */

            let deposit_obj = {
                brand_id: dns_data?.id,
                pay_type,
                expect_amount: (-1) * amount,
                settle_bank_code: withdraw_bank_code,
                settle_acct_num: withdraw_acct_num,
                settle_acct_name: withdraw_acct_name,
                withdraw_fee: user?.withdraw_fee,
                user_id: user?.id,
                withdraw_status: 5,
                note: note,
                withdraw_fee_type: dns_data?.withdraw_fee_type,
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
            let settle_amount = await readPool.query(settle_amount_sql);
            settle_amount = settle_amount[0][0]?.settle_amount ?? 0;
            if (dns_data?.default_withdraw_max_price < withdraw_amount) {
                await redisCtrl.delete(`is_ing_withdraw_${mid}_${withdraw_acct_num}`);
                return response(req, res, -100, `최대 ${pay_type_name}액은 ${commarNumber(dns_data?.default_withdraw_max_price)}원 입니다.`, false)
            }
            if (amount > settle_amount) {
                await redisCtrl.delete(`is_ing_withdraw_${mid}_${withdraw_acct_num}`);
                return response(req, res, -100, `${pay_type_name} 요청금이 보유정산금보다 많습니다.`, false)
            }
            if (settle_amount < user?.min_withdraw_remain_price) {
                await redisCtrl.delete(`is_ing_withdraw_${mid}_${withdraw_acct_num}`);
                return response(req, res, -100, `최소 ${pay_type_name}잔액은 ${commarNumber(user?.min_withdraw_remain_price)}원 입니다.`, false)
            }
            if (parseInt(withdraw_amount) < user?.min_withdraw_price) {
                await redisCtrl.delete(`is_ing_withdraw_${mid}_${withdraw_acct_num}`);
                return response(req, res, -100, `최소 ${pay_type_name}액은 ${commarNumber(user?.min_withdraw_price)}원 입니다.`, false)
            }
            if (parseInt(withdraw_amount) > user?.max_withdraw_price && user?.max_withdraw_price > 0) {
                await redisCtrl.delete(`is_ing_withdraw_${mid}_${withdraw_acct_num}`);
                return response(req, res, -100, `최대 ${pay_type_name}액은 ${commarNumber(user?.max_withdraw_price)}원 입니다.`, false)
            }
            if (settle_amount - amount < user?.min_withdraw_hold_price) {
                await redisCtrl.delete(`is_ing_withdraw_${mid}_${withdraw_acct_num}`);
                return response(req, res, -100, `최소 ${pay_type_name} 보류금액은 ${commarNumber(user?.min_withdraw_hold_price)}원 입니다.`, false)
            }
            if (user?.is_withdraw_hold == 1) {
                deposit_obj['is_withdraw_hold'] = 1;
            }

            let mother_account = await getMotherDeposit(dns_data);

            if (withdraw_amount > mother_account?.real_amount - (mother_account?.hold_amount ?? 0)) {
                await redisCtrl.delete(`is_ing_withdraw_${mid}_${withdraw_acct_num}`);
                return response(req, res, -100, "모계좌 출금 실패 A", false)
            }
            let last_deposit_same_acct_num = await readPool.query(`SELECT id FROM deposits WHERE brand_id=${dns_data?.id} AND created_at >= NOW() - INTERVAL 1 MINUTE AND settle_acct_num=? AND user_id=${user?.id} `, [
                withdraw_acct_num
            ])
            last_deposit_same_acct_num = last_deposit_same_acct_num[0][0];
            if (last_deposit_same_acct_num && user?.is_not_same_acct_withdraw_minute == 1) {
                await redisCtrl.delete(`is_ing_withdraw_${mid}_${withdraw_acct_num}`);
                return response(req, res, -100, "1분내 동일계좌 출금이 불가합니다.", false)
            }

            let check_account = await corpApi.account.info({
                pay_type: 'withdraw',
                dns_data: dns_data,
                decode_user: user,
                bank_code: withdraw_bank_code,
                acct_num: withdraw_acct_num,
                birth: identity.length > 6 ? '' : identity,
                business_num: identity.length > 6 ? identity : '',
                user_type: identity.length > 6 ? 1 : 0,
            })
            if (check_account.code != 100) {
                await redisCtrl.delete(`is_ing_withdraw_${mid}_${withdraw_acct_num}`);
                return response(req, res, -110, (check_account?.message || "서버 에러 발생"), false)
            }
            if (withdraw_acct_name != check_account.data?.withdraw_acct_name) {
                await redisCtrl.delete(`is_ing_withdraw_${mid}_${withdraw_acct_num}`);
                return response(req, res, -100, "예금주명이 일치하지 않습니다.", false)
            }
            let withdraw_id = 0;
            let result = await insertQuery(`deposits`, deposit_obj);
            withdraw_id = result?.insertId;
            //인설트후 체크
            let settle_amount_2 = await readPool.query(settle_amount_sql);
            settle_amount_2 = settle_amount_2[0][0]?.settle_amount ?? 0;
            if (settle_amount_2 < 0) {
                let delete_result = await deleteQuery(`deposits`, { id: withdraw_id }, true);
                await redisCtrl.delete(`is_ing_withdraw_${mid}_${withdraw_acct_num}`);
                return response(req, res, -100, `${pay_type_name} 요청금이 보유정산금보다 많습니다.`, false)
            }
            //
            if (user?.is_withdraw_hold == 1) {
                await redisCtrl.delete(`is_ing_withdraw_${mid}_${withdraw_acct_num}`);
                return response(req, res, 100, "출금 요청이 완료되었습니다.", {});
            }

            let api_withdraw_request_result = await corpApi.withdraw.request({
                pay_type: 'withdraw',
                dns_data: dns_data,
                decode_user: user,
                amount: withdraw_amount - (dns_data?.withdraw_fee_type == 0 ? 0 : user?.withdraw_fee),
                bank_code: withdraw_bank_code,
                acct_num: withdraw_acct_num,
                acct_name: withdraw_acct_name,
            })
            if (api_withdraw_request_result.code != 100) {
                await redisCtrl.delete(`is_ing_withdraw_${mid}_${withdraw_acct_num}`);
                return response(req, res, -120, (api_withdraw_request_result?.message || "서버 에러 발생"), false)
            }
            let result3 = await updateQuery(`deposits`, {
                trx_id: api_withdraw_request_result.data?.tid,
                top_office_amount: api_withdraw_request_result.data?.top_amount,
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


export default withdrawV3Ctrl;
