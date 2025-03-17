import { readPool } from "../../config/db-pool.js";
import { sendTelegramBot } from "../../telegram/index.js";

const SEND_CHAT_IDS = [
    {
        id: 123,
        level: 10,
    },
    {
        id: 1234,
        level: 40,
    },
]
const TELEBOT_DATA = {
    is_use_telegram_bot: 1,
    telegram_bot_token: '',
}
export const onSettleTopOffer = async (return_moment = "") => {
    try {
        if (!return_moment.includes('01:00:')) {
            return;
        }
        let virtual_accounts = await readPool.query(`SELECT * FROM virtual_accounts WHERE is_use_settle_top_offer=1`);
        virtual_accounts = virtual_accounts[0][0];
        let brand_ids = virtual_accounts.map(el => { return el?.brand_id });
        let brand_ids_set = new Set(brand_ids);
        brand_ids = [...brand_ids];
        if (brand_ids.length != brand_ids_set) {
            let message = `가상계좌 등록 갯수에 이슈가 있습니다.`
            sendTelegramBot(TELEBOT_DATA, message, SEND_CHAT_IDS.filter(el => el?.level >= 40).map(el => { return el.id }));
            return;
        }

    } catch (err) {
        console.log(err);
    }
}
const onProcessSettle = (virtual_accounts) => {

}