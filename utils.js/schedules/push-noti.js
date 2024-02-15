import { pool } from "../../config/db.js";
import { sendNotiPush } from "../util.js";

export const pushDepositNoti = async () => {
    try {
        let brands = await pool.query(`SELECT * FROM brands`);
        brands = brands?.result;
        let columns = [
            `deposits.*`,
            `users.deposit_noti_url`,
        ]
        let sql = `SELECT ${columns.join()} FROM deposits `
        sql += ` LEFT JOIN users ON deposits.mcht_id=users.id `;
        sql += ` WHERE deposits.deposit_noti_status=5 ORDER BY id ASC`;
        let data = await pool.query(sql);
        data = data?.result;
        for (var i = 0; i < data.length; i++) {
            sendNotiPush(data[i], 'deposit', JSON.parse(data[i]?.deposit_noti_obj ?? '{}'), data[i]?.id);
        }
    } catch (err) {
        console.log(err);
    }
}