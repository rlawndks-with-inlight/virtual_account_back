import { pool } from "../../config/db.js";
import { sendNotiPush } from "../util.js";

export const pushDepositNoti = async () => {
    try {
        let columns = [
            `deposits.*`,
            `users.deposit_noti_url`,
        ]
        let sql = `SELECT ${columns.join()} FROM deposits `
        sql += ` LEFT JOIN users ON deposits.mcht_id=users.id `;
        sql += ` WHERE deposits.deposit_noti_status=5 `;
        sql += ` AND CHAR_LENGTH(users.deposit_noti_url) > 0 `;
        sql += ` AND users.is_delete=0 `;
        sql += ` ORDER BY id ASC `;
        let data = await pool.query(sql);
        data = data?.result;
        for (var i = 0; i < data.length; i++) {
            sendNotiPush(data[i], 'deposit', JSON.parse(data[i]?.deposit_noti_obj ?? '{}'), data[i]?.id);
        }
    } catch (err) {
        console.log(err);
    }
}