import { readPool } from "../../config/db-pool.js";
import { sendTelegramBot } from "../../telegram/index.js";
import { returnMoment } from "../function.js";
import { commarNumber } from "../util.js";

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
export const onSettleTopOffer = async (return_moment = "") => {
    try {
        if (!return_moment.includes('01:00:') && !return_moment.includes('00:01:')) {
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
                onProcessSettle(virtual_accounts);
            }
        }
        if (return_moment.includes('00:01:')) {
            let brands = await readPool.query(`SELECT id, name FROM brands WHERE sales_parent_id=${parent_brand?.id}`);
            brands = brands[0];
            sendSettleAlarm(brands, parent_brand);
        }

    } catch (err) {
        console.log(err);
    }
}
const onProcessSettle = async (virtual_accounts = []) => {
    try {
        let brand_ids = virtual_accounts.map(el => { return el?.brand_id });
        //

    } catch (err) {
        console.log(err)
    }
}
const sendSettleAlarm = async (brands = []) => {
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