import _ from "lodash";
import { pool } from "../../config/db.js";
import { sendNotiPush } from "../util.js";

export const pushDepositNoti = async () => {
    try {
        let users = await pool.query(`SELECT id, deposit_noti_url FROM users WHERE CHAR_LENGTH(users.deposit_noti_url) > 0 AND is_delete=0`);
        users = users?.result;
        if (users.length == 0) {
            return;
        }
        let user_ids = users.map(el => { return el?.id });
        let columns = [
            `deposits.id`,
            `deposits.user_id`,
            `deposits.deposit_noti_obj`,
        ]
        let sql = `SELECT ${columns.join()} FROM deposits `
        sql += ` WHERE deposits.deposit_noti_status=5 `;
        sql += ` AND deposits.user_id IN (${user_ids.join()}) `;
        sql += ` ORDER BY id ASC `;
        let data = await pool.query(sql);
        data = data?.result;
        for (var i = 0; i < data.length; i++) {
            sendNotiPush(_.find(users, { id: data[i]?.user_id }), 'deposit', JSON.parse(data[i]?.deposit_noti_obj ?? '{}'), data[i]?.id);
        }
    } catch (err) {
        console.log(err);
    }
}
