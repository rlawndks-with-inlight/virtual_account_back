import 'dotenv/config';
import { pool } from '../../config/db.js';
import axios from 'axios';
import { updateQuery } from '../query-util.js';
import { returnMoment } from '../function.js';

export const pushAsapMall = async (return_moment = "") => {
    let moment_list = [
        ':00:00',
        ':10:00',
        ':20:00',
        ':30:00',
        ':40:00',
        ':50:00',
    ];
    let is_process_func = false;
    for (var i = 0; i < moment_list.length; i++) {
        if (return_moment.includes(moment_list[i])) {
            is_process_func = true;
            break;
        }
    }
    if (!is_process_func) {
        return;
    }
    let sql = ` SELECT deposits.*, brands.asapmall_dns FROM deposits `;
    sql += ` LEFT JOIN brands ON deposits.brand_id=brands.id `;
    sql += ` WHERE brands.is_use_asapmall_noti=1 AND pay_type IN (0, 5, 20) `;
    sql += ` AND deposits.send_asapmall_noti=5 `;
    sql += ` ORDER BY deposits.id ASC `;
    let data = await pool.query(sql);
    data = data?.result;
    for (var i = 0; i < data.length; i++) {
        let {
            asapmall_dns,
            pay_type,
            amount,
            withdraw_fee,
            trx_id,
            deposit_acct_name,
            settle_acct_name,
            id,
            created_at
        } = data[i];
        if (amount > 0 || amount < 0) {
            let obj = {
                dns: asapmall_dns,
                amount: amount,
                tid: trx_id,
                created_at,
            };
            if (pay_type == 0) {
                obj['pay_type'] = 'deposit';
                obj['acct_name'] = deposit_acct_name;

            } else if (pay_type == 5) {
                obj['pay_type'] = 'withdraw';
                obj['amount'] = amount + withdraw_fee;
                obj['acct_name'] = settle_acct_name;


            } else if (pay_type == 20) {
                obj['pay_type'] = 'return';
                obj['amount'] = amount + withdraw_fee;
                obj['acct_name'] = settle_acct_name;
            }
            let { data: response } = await axios.post(`${process.env.SHOPPING_MALL_BACK_URL}/api/pays/virtual-acct/noti`, obj);
            if (response?.result > 0) {
                let result = await updateQuery(`deposits`, {
                    send_asapmall_noti: 0,
                }, id)
            }
        }
    }
}