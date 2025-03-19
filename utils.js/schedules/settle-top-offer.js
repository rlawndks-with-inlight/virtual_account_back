import _ from "lodash";
import { readPool } from "../../config/db-pool.js";
import { sendTelegramBot } from "../../telegram/index.js";
import { returnMoment } from "../function.js";
import { commarNumber, getOperatorList, setWithdrawAmountSetting } from "../util.js";
import corpApi from "../corp-util/index.js";
import logger from "../winston/index.js";
import { insertQuery, updateQuery } from "../query-util.js";

const SEND_CHAT_IDS = [
    {
        id: '123',
        level: 10,
        user_name: 'ivi00',
    },
    {
        id: '7362742274',
        level: 40,
        user_name: 'danial',
    },
    {
        id: '6672839598',
        level: 40,
        user_name: 'harry',
    },
]
const TELEBOT_DATA = {
    is_use_telegram_bot: 1,
    telegram_bot_token: '8065972074:AAF6HPiomYnHpsXmbQcMc6hLfyYGn69hJ-E',
}
const SETTLE_ACCT_NUM = `1012077477601`;

export const onSettleTopOffer = async (return_moment = "") => {
    try {
        if (!return_moment.includes('01:00:') && !return_moment.includes('00:40:')) {
            return;
        }
        let virtual_accounts = await readPool.query(`SELECT * FROM virtual_accounts WHERE is_use_settle_top_offer=1`);
        virtual_accounts = virtual_accounts[0];
        let brand_ids = virtual_accounts.map(el => { return el?.brand_id });
        let brand_ids_set = new Set(brand_ids);
        brand_ids_set = [...brand_ids_set];
        let parent_brand = await readPool.query(`SELECT * FROM brands WHERE is_oper_dns=1`);
        parent_brand = parent_brand[0][0];
        if (return_moment.includes('01:00:')) {
            if (brand_ids.length != brand_ids_set.length) {
                let message = `가상계좌 등록 갯수에 이슈가 있습니다.`
                sendTelegramBot(TELEBOT_DATA, message, SEND_CHAT_IDS.filter(el => el?.level >= 40).map(el => { return el.id }));
                return;
            }
            if (virtual_accounts.length > 0) {
                onProcessSettle(virtual_accounts, parent_brand);
            }
        }
        if (return_moment.includes('00:40:')) {
            let brands = await readPool.query(`SELECT id, name FROM brands WHERE sales_parent_id=${parent_brand?.id}`);
            brands = brands[0];
            sendSettleAlarm(brands, parent_brand);
        }

    } catch (err) {
        console.log(err);
    }
}
const onProcessSettle = async (virtual_accounts = [], parent_brand) => {
    try {
        let brand_ids = virtual_accounts.map(el => { return el?.brand_id });
        let brands = await readPool.query(`SELECT * FROM brands WHERE sales_parent_id=${parent_brand?.id} AND id IN (${brand_ids.join()})`);
        brands = brands[0];

        let operator_list = getOperatorList(parent_brand);

        for (var i = 0; i < brands.length; i++) {
            onWithdrawSettleByBrand(brands[i], parent_brand, operator_list, _.find(virtual_accounts, { brand_id: brands[i]?.id }));
        }
    } catch (err) {
        console.log(err)
    }
}
const onWithdrawSettleByBrand = async (brand = {}, parent_brand = {}, operator_list = [], virtual_account) => {
    try {
        let withdraw_amount = 0;
        let mcht = await readPool.query(`SELECT * FROM users WHERE id=?`, [virtual_account?.mcht_id]);
        mcht = mcht[0][0];
        if (SETTLE_ACCT_NUM != virtual_account?.deposit_acct_num) {
            return;
        }
        let withdraw_obj = {
            brand_id: brand?.id,
            pay_type: 5,
            settle_bank_code: virtual_account?.deposit_bank_code,
            settle_acct_num: virtual_account?.deposit_acct_num,
            settle_acct_name: virtual_account?.deposit_acct_name,
            user_id: virtual_account?.id,
            mcht_id: virtual_account?.mcht_id,
            withdraw_status: 5,
            note: `${brand?.name} 누적 상위사 정산금 정산`,
            withdraw_fee_type: brand?.withdraw_fee_type,
        };
        let top_offer_obj = {};
        for (var i = 0; i < operator_list.length; i++) {
            if (brand[`top_offer${operator_list[i]?.num}_id`] > 0) {
                let top_offer_amount = await readPool.query(`SELECT SUM(top_offer${operator_list[i]?.num}_amount) AS top_offer_amount FROM deposits WHERE top_offer${operator_list[i]?.num}_id=? AND brand_id=?`, [
                    brand[`top_offer${operator_list[i]?.num}_id`],
                    brand?.id,
                ])
                top_offer_amount = top_offer_amount[0][0]?.top_offer_amount ?? 0;
                if (parseInt(top_offer_amount) > 0) {
                    withdraw_amount += parseInt(top_offer_amount);
                    top_offer_obj[`top_offer${operator_list[i]?.num}_id`] = brand[`top_offer${operator_list[i]?.num}_id`];
                    top_offer_obj[`top_offer${operator_list[i]?.num}_amount`] = parseInt(top_offer_amount) * (-1);
                }
            }
        }
        let amount = parseInt(withdraw_amount) + (brand?.withdraw_fee_type == 0 ? mcht?.withdraw_fee : 0);
        withdraw_obj['expect_amount'] = (-1) * amount;
        withdraw_obj[`mcht_amount`] = (-1) * amount;
        let withdraw_id = 0;
        let result = await insertQuery(`deposits`, withdraw_obj);
        withdraw_id = result?.insertId;
        let trx_id = `${brand?.id}${virtual_account?.id % 1000}${new Date().getTime()}`;
        let api_withdraw_request_result = await corpApi.withdraw.request({
            pay_type: 'withdraw',
            dns_data: brand,
            decode_user: mcht,
            ci: virtual_account?.ci,
            trx_id: trx_id,
            amount: withdraw_amount,
        })
        if (api_withdraw_request_result.code != 100) {
            logger.error('출금 시도중 에러1 ' + `${JSON.stringify(api_withdraw_request_result)}`)
        }
        let result3 = await updateQuery(`deposits`, {
            trx_id: api_withdraw_request_result.data?.tid,
            top_office_amount: api_withdraw_request_result.data?.top_amount ?? 0,
        }, withdraw_id);
        for (var i = 0; i < 3; i++) {
            let api_result2 = await corpApi.withdraw.request_check({
                pay_type: 'withdraw',
                dns_data: brand,
                decode_user: mcht,
                ci: virtual_account?.ci,
                tid: trx_id,
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
                    amount: (status == 0 ? ((-1) * amount) : 0),
                }
                let temporary_withdraw_obj = await setWithdrawAmountSetting(withdraw_amount, mcht, brand);
                if (status == 0) {
                    update_obj = {
                        ...update_obj,
                        ...temporary_withdraw_obj,
                        ...top_offer_obj,
                    }
                }
                let result = await updateQuery(`deposits`, update_obj, withdraw_id);
                if (status == 0) {
                    logger.info(`${brand?.name} 정산 출금이 완료됨`);
                    let message = `${brand?.name} 정산 출금이 완료됨\n`;
                    message += `${commarNumber(withdraw_amount)}원`
                    sendTelegramBot(TELEBOT_DATA, message, SEND_CHAT_IDS.filter(el => el?.level >= 40).map(el => { return el.id }));
                }
                break;
            }
        }
    } catch (err) {
        console.log(err);
    }
}
const sendSettleAlarm = async (brands = [], parent_brand) => {
    try {
        for (var i = 0; i < brands.length; i++) {
            let chart_data = await getSettleDataByBrand(brands[i]);
            if (chart_data) {
                console.log(chart_data)
            } else {
                continue;
            }
            let message = `${brands[i]?.name} ${chart_data.date}\n\n`;
            message += `입금\n`
            message += `입금횟수: ${commarNumber(chart_data.deposit.total)}회\n`
            message += `입금금액: ${commarNumber(chart_data.deposit.amount)}원\n\n`
            message += `출금\n`
            message += `출금횟수: ${commarNumber(chart_data.withdraw.total)}회\n`
            message += `출금금액: ${commarNumber(chart_data.withdraw.amount)}원`
            sendTelegramBot(TELEBOT_DATA, message, SEND_CHAT_IDS.filter(el => el?.level >= 40).map(el => { return el.id }));
        }
    } catch (err) {
        console.log(err);
    }
}
const getSettleDataByBrand = async (brand = {}) => {
    try {
        let yesterday = returnMoment(false, -1).substring(0, 10);
        let deposit_columns = [
            `COUNT(*) AS total`,
            `SUM(amount) AS amount`,
        ];
        let deposit_chart_sql = `SELECT ${deposit_columns.join()} FROM deposits `;
        deposit_chart_sql += ` WHERE brand_id=${brand?.id} `;
        deposit_chart_sql += ` AND created_at >= CURDATE() - INTERVAL 1 DAY AND created_at < CURDATE() `;
        deposit_chart_sql += ` AND pay_type=0 `;
        deposit_chart_sql += ` AND deposit_status=0 `;
        let deposit_chart = await readPool.query(deposit_chart_sql);
        deposit_chart = deposit_chart[0][0];

        let withdraw_columns = [
            `COUNT(*) AS total`,
            `SUM(amount) AS amount`,
            `SUM(withdraw_fee) AS withdraw_fee`,
        ];
        let withdraw_chart_sql = `SELECT ${withdraw_columns.join()} FROM deposits `;
        withdraw_chart_sql += ` WHERE brand_id=${brand?.id} `;
        withdraw_chart_sql += ` AND created_at >= CURDATE() - INTERVAL 1 DAY AND created_at < CURDATE() `;
        withdraw_chart_sql += ` AND pay_type IN (5, 20) `;
        withdraw_chart_sql += ` AND withdraw_status=0 `;
        let withdraw_chart = await readPool.query(withdraw_chart_sql);
        withdraw_chart = withdraw_chart[0][0];
        if (deposit_chart?.total == 0 && withdraw_chart?.total == 0) {
            return false;
        }
        let chart = {
            date: yesterday,
            deposit: {
                total: deposit_chart?.total,
                amount: deposit_chart?.amount,
            },
            withdraw: {
                total: withdraw_chart?.total,
                amount: Math.abs(withdraw_chart?.amount + withdraw_chart?.withdraw_fee),
            }
        }
        return chart;
    } catch (err) {
        console.log(err);
        return false;
    }
}