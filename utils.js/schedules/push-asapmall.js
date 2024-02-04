import 'dotenv/config';
import { pool } from '../../config/db.js';

export const pushAsapMall = async () => {
    let sql = ` SELECT * FROM deposits `;
    sql += ` LEFT JOIN brands ON deposits.brand_id=brands.id `;
    sql += ` WHERE brands.is_use_asapmall_noti=1 AND deposits.send_asapmall_noti=5 `;
    sql += ` ORDER BY deposits.id ASC `;
    let data = await pool.query(sql);
    data = data?.result;
    console.log(data);
}