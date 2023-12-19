import { banknersApi } from "./bankners.js";

const corpApi = {
    user: {
        info: async (dns_data, pay_type, decode_user) => {//유저정보 출력
            let deposit_user_info = {};
            let withdraw_user_info = {};
            if (dns_data?.deposit_corp_type == 1) {
                deposit_user_info = await banknersApi.user.info(dns_data, pay_type, decode_user);
            }
        },
    }
}

export default corpApi;