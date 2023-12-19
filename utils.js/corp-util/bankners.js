import axios from 'axios';
import 'dotenv/config';
import crypto from 'crypto';

const API_URL = process.env.NODE_ENV == 'production' ? "https://stgapi.bankners.com" : "https://api.bankners.com";

const makeHeaderData = (dns_data, pay_type, decode_user) => {
    let cur_time = new Date().getTime();
    let req_uniq_no = `${cur_time}${dns_data?.id}${decode_user?.id}`;
    console.log(dns_data[`${pay_type}_api_id`])
    console.log(req_uniq_no)
    console.log(dns_data[`${pay_type}_sign_key`])
    let api_sign_val = crypto.createHash('sha256').update(`${dns_data[`${pay_type}_api_id`]}${req_uniq_no}${dns_data[`${pay_type}_sign_key`]}`).digest('hex');
    console.log(api_sign_val)
    return {
        'Content-Type': 'application/json',
        'api_id': dns_data[`${pay_type}_api_id`],
        'api_sign_val': api_sign_val,
        'req_uniq_no': req_uniq_no,
    }
}
export const banknersApi = {
    user: {
        info: async (dns_data, pay_type, decode_user) => {
            try {

                let query = {
                    guid: dns_data[`${pay_type}_guid`]
                }
                query = new URLSearchParams(query).toString();
                console.log(query)
                let result = await axios.get(`${API_URL}/api/user/info?${query}`, {
                    headers: makeHeaderData(dns_data, pay_type, decode_user)
                })
                console.log(result)
            } catch (err) {
                console.log(err);
                return {};
            }
        }
    }
}

banknersApi.user.info()