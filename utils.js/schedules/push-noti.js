import _ from "lodash";
import { sendNotiPush } from "../util.js";
import { readPool } from "../../config/db-pool.js";

export const pushDepositNoti = async () => {
    try {
        let users = await readPool.query(`SELECT id, deposit_noti_url FROM users WHERE CHAR_LENGTH(users.deposit_noti_url) > 0 AND is_delete=0`);
        users = users[0];
        if (users.length == 0) {
            return;
        }
        let user_ids = users.map(el => { return el?.id });
        let columns = [
            `deposits.id`,
            `deposits.mcht_id`,
            `deposits.deposit_noti_obj`,
        ]
        let sql = `SELECT ${columns.join()} FROM deposits `
        sql += ` WHERE deposits.deposit_noti_status=5 `;
        sql += ` AND deposits.mcht_id IN (${user_ids.join()}) `;
        sql += ` ORDER BY id ASC `;
        let data = await readPool.query(sql);
        data = data[0];
        for (var i = 0; i < data.length; i++) {
            sendNotiPush(_.find(users, { id: data[i]?.mcht_id }), 'deposit', JSON.parse(data[i]?.deposit_noti_obj ?? '{}'), data[i]?.id);
        }
    } catch (err) {
        console.log(err);
    }
}
