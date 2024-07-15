import { pool } from "../../config/db.js";
import { selectQuerySimple } from "../query-util.js";
import { findChildIds, findParents } from "../util.js";
import { banknersApi } from "./bankners.js";
import { cooconApi } from "./coocon.js";
import { doznApi } from "./dozn.js";
import { hectoApi } from "./hecto.js";
import { icbApi } from "./icb.js";
import { koreaPaySystemApi } from "./korea-pay-system.js";
import { paytusApi } from "./paytus.js";

export const getDnsData = async (dns_data_) => {
    let dns_data = await selectQuerySimple('brands', dns_data_?.id);

    dns_data = dns_data?.result[0];
    dns_data['theme_css'] = JSON.parse(dns_data?.theme_css ?? '{}');
    dns_data['setting_obj'] = JSON.parse(dns_data?.setting_obj ?? '{}');
    dns_data['level_obj'] = JSON.parse(dns_data?.level_obj ?? '{}');
    dns_data['bizppurio_obj'] = JSON.parse(dns_data?.bizppurio_obj ?? '{}');

    let brands = await pool.query(`SELECT id, parent_id FROM brands `);
    brands = brands?.result;
    let childrens = findChildIds(brands, dns_data?.id);
    childrens.push(dns_data?.id)
    let parents = findParents(brands, dns_data)
    dns_data['childrens'] = childrens;
    dns_data['parents'] = parents;
    return dns_data;
}
const default_result = {
    code: 100,
    data: {},
    message: ''
};
const corpApi = {
    user: {
        info: async (data_) => {//유저정보 출력
            let data = data_;
            let { dns_data, pay_type } = data;
            dns_data = await getDnsData(dns_data);
            data['dns_data'] = dns_data;

            let result = default_result;
            let corp_type = dns_data?.deposit_corp_type || dns_data?.withdraw_corp_type;
            if (dns_data?.setting_obj?.is_use_deposit == 1) {
                corp_type = dns_data?.deposit_corp_type;
            } else if (dns_data?.setting_obj?.is_use_withdraw == 1) {
                corp_type = dns_data?.withdraw_corp_type;
            }
            if (pay_type) {
                corp_type = dns_data[`${pay_type}_corp_type`];
            }
            if (corp_type == 1) {
                result = await banknersApi.user.info(data);
            }
            return result;
        },
        create: async (data_) => {//유저정보 출력
            let data = data_;
            let { dns_data, pay_type } = data;
            dns_data = await getDnsData(dns_data);
            data['dns_data'] = dns_data;

            let result = default_result;
            let corp_type = dns_data?.deposit_corp_type || dns_data?.withdraw_corp_type;
            if (dns_data?.setting_obj?.is_use_deposit == 1) {
                corp_type = dns_data?.deposit_corp_type;
            } else if (dns_data?.setting_obj?.is_use_withdraw == 1) {
                corp_type = dns_data?.withdraw_corp_type;
            }
            if (pay_type) {
                corp_type = dns_data[`${pay_type}_corp_type`];
            }
            if (corp_type == 1) {
                result = await banknersApi.user.create(data);
            }
            return result;
        },
        remove: async (data_) => {//출금계좌등록
            let data = data_;
            let { dns_data, pay_type } = data;
            dns_data = await getDnsData(dns_data);
            data['dns_data'] = dns_data;

            let result = default_result;
            let corp_type = dns_data?.deposit_corp_type || dns_data?.withdraw_corp_type;
            if (dns_data?.setting_obj?.is_use_deposit == 1) {
                corp_type = dns_data?.deposit_corp_type;
            } else if (dns_data?.setting_obj?.is_use_withdraw == 1) {
                corp_type = dns_data?.withdraw_corp_type;
            }
            if (pay_type) {
                corp_type = dns_data[`${pay_type}_corp_type`];
            }

            if (corp_type == 1) {
                result = await banknersApi.user.remove(data);
            }
            return result;
        },
        account_verify: async (data_) => {//출금계좌등록
            let data = data_;
            let { dns_data, pay_type } = data;
            dns_data = await getDnsData(dns_data);
            data['dns_data'] = dns_data;

            let result = default_result;
            let corp_type = dns_data?.deposit_corp_type || dns_data?.withdraw_corp_type;
            if (dns_data?.setting_obj?.is_use_deposit == 1) {
                corp_type = dns_data?.deposit_corp_type;
            } else if (dns_data?.setting_obj?.is_use_withdraw == 1) {
                corp_type = dns_data?.withdraw_corp_type;
            }
            if (pay_type) {
                corp_type = dns_data[`${pay_type}_corp_type`];
            }

            if (corp_type == 1) {
                result = await banknersApi.user.account_verify(data);
            }
            return result;
        },
        account_delete: async (data_) => {//출금계좌등록
            let data = data_;
            let { dns_data, pay_type } = data;
            dns_data = await getDnsData(dns_data);
            data['dns_data'] = dns_data;

            let result = default_result;
            let corp_type = dns_data?.deposit_corp_type || dns_data?.withdraw_corp_type;
            if (dns_data?.setting_obj?.is_use_deposit == 1) {
                corp_type = dns_data?.deposit_corp_type;
            } else if (dns_data?.setting_obj?.is_use_withdraw == 1) {
                corp_type = dns_data?.withdraw_corp_type;
            }
            if (pay_type) {
                corp_type = dns_data[`${pay_type}_corp_type`];
            }

            if (corp_type == 1) {
                result = await banknersApi.user.account_delete(data);
            }
            return result;
        },
        account: {
            create: async (data_) => {//출금계좌등록
                let data = data_;
                let { dns_data, pay_type } = data;
                dns_data = await getDnsData(dns_data);
                data['dns_data'] = dns_data;

                let result = default_result;
                let corp_type = dns_data?.deposit_corp_type || dns_data?.withdraw_corp_type;
                if (dns_data?.setting_obj?.is_use_deposit == 1) {
                    corp_type = dns_data?.deposit_corp_type;
                } else if (dns_data?.setting_obj?.is_use_withdraw == 1) {
                    corp_type = dns_data?.withdraw_corp_type;
                }
                if (pay_type) {
                    corp_type = dns_data[`${pay_type}_corp_type`];
                }

                if (corp_type == 1) {
                    result = await banknersApi.user.account(data);
                }
                return result;
            },
            info: async (data_) => {//이체
                let data = data_;
                let { dns_data, pay_type } = data;
                dns_data = await getDnsData(dns_data);
                data['dns_data'] = dns_data;
                let result = default_result;
                let corp_type = dns_data?.deposit_corp_type || dns_data?.withdraw_corp_type;
                if (dns_data?.setting_obj?.is_use_deposit == 1) {
                    corp_type = dns_data?.deposit_corp_type;
                } else if (dns_data?.setting_obj?.is_use_withdraw == 1) {
                    corp_type = dns_data?.withdraw_corp_type;
                }
                if (pay_type) {
                    corp_type = dns_data[`${pay_type}_corp_type`];
                }
                if (corp_type == 2) {
                    result = await cooconApi.account.info(data);
                }
                return result;
            },
        },
    },
    transfer: {
        pass: async (data_) => {//이체
            let data = data_;
            let { dns_data, pay_type } = data;
            dns_data = await getDnsData(dns_data);
            data['dns_data'] = dns_data;

            let result = default_result;
            let corp_type = dns_data?.deposit_corp_type || dns_data?.withdraw_corp_type;
            if (dns_data?.setting_obj?.is_use_deposit == 1) {
                corp_type = dns_data?.deposit_corp_type;
            } else if (dns_data?.setting_obj?.is_use_withdraw == 1) {
                corp_type = dns_data?.withdraw_corp_type;
            }
            if (pay_type) {
                corp_type = dns_data[`${pay_type}_corp_type`];
            }

            if (corp_type == 1) {
                result = await banknersApi.transfer.pass(data);
            }
            return result;
        },
    },
    balance: {
        info: async (data_) => {//유저정보 출력
            let data = data_;
            let { dns_data, pay_type } = data;
            dns_data = await getDnsData(dns_data);
            data['dns_data'] = dns_data;

            let result = default_result;
            let corp_type = dns_data?.deposit_corp_type || dns_data?.withdraw_corp_type;
            if (dns_data?.setting_obj?.is_use_deposit == 1) {
                corp_type = dns_data?.deposit_corp_type;
            } else if (dns_data?.setting_obj?.is_use_withdraw == 1) {
                corp_type = dns_data?.withdraw_corp_type;
            }
            if (pay_type) {
                corp_type = dns_data[`${pay_type}_corp_type`];
            }
            if (corp_type == 1) {
                result = await banknersApi.balance.info(data);
            }
            if (corp_type == 2) {
                result = await cooconApi.balance.info(data);
            }
            if (corp_type == 5) {
                result = await hectoApi.balance.info(data);
            }
            if (corp_type == 6) {
                result = await koreaPaySystemApi.balance.info(data);
            }
            if (corp_type == 7) {
                result = await icbApi.balance.info(data);
            }
            return result;
        },
    },
    bank: {
        list: async (data_) => {//은행정보 출력
            let data = data_;
            let { dns_data, pay_type } = data;
            dns_data = await getDnsData(dns_data);
            data['dns_data'] = dns_data;
            let result = default_result;
            let corp_type = '';
            if (dns_data?.setting_obj?.is_use_deposit == 1) {
                corp_type = dns_data?.deposit_corp_type;
            } else if (dns_data?.setting_obj?.is_use_withdraw == 1) {
                corp_type = dns_data?.withdraw_corp_type;
            }
            if (pay_type) {
                corp_type = dns_data[`${pay_type}_corp_type`];
            }
            if (corp_type == 1) {
                result = await banknersApi.bank.list(data);
            } else if (corp_type == 2) {
                result = await cooconApi.bank.list(data);
            } else if (corp_type == 3) {
                result = await paytusApi.bank.list(data);
            } else if (corp_type == 4) {
                result = await doznApi.bank.list(data);
            } else if (corp_type == 5) {
                result = await hectoApi.bank.list(data);
            } else if (corp_type == 6) {
                result = await koreaPaySystemApi.bank.list(data);
            } else if (corp_type == 7) {
                result = await icbApi.bank.list(data);
            } else {
                result = await banknersApi.bank.list(data);
            }

            return result;
        },
    },
    vaccount: async (data_) => {//가상계좌발급
        let data = data_;
        let { dns_data, pay_type } = data;
        dns_data = await getDnsData(dns_data);
        data['dns_data'] = dns_data;

        let result = default_result;
        let corp_type = dns_data?.deposit_corp_type || dns_data?.withdraw_corp_type;
        if (dns_data?.setting_obj?.is_use_deposit == 1) {
            corp_type = dns_data?.deposit_corp_type;
        } else if (dns_data?.setting_obj?.is_use_withdraw == 1) {
            corp_type = dns_data?.withdraw_corp_type;
        }
        if (pay_type) {
            corp_type = dns_data[`${pay_type}_corp_type`];
        }
        if (corp_type == 1) {
            result = await banknersApi.vaccount(data);
        }
        return result;
    },
    vaccount_info: async (data_) => {//가상계좌발급
        let data = data_;
        let { dns_data, pay_type } = data;
        dns_data = await getDnsData(dns_data);
        data['dns_data'] = dns_data;

        let result = default_result;
        let corp_type = dns_data?.deposit_corp_type || dns_data?.withdraw_corp_type;
        if (dns_data?.setting_obj?.is_use_deposit == 1) {
            corp_type = dns_data?.deposit_corp_type;
        } else if (dns_data?.setting_obj?.is_use_withdraw == 1) {
            corp_type = dns_data?.withdraw_corp_type;
        }
        if (pay_type) {
            corp_type = dns_data[`${pay_type}_corp_type`];
        }
        if (corp_type == 1) {
            result = await banknersApi.vaccount_info(data);
        }
        return result;
    },
    vaccount_delete: async (data_) => {//가상계좌삭제
        let data = data_;
        let { dns_data, pay_type } = data;
        dns_data = await getDnsData(dns_data);
        data['dns_data'] = dns_data;

        let result = default_result;
        let corp_type = dns_data?.deposit_corp_type || dns_data?.withdraw_corp_type;
        if (dns_data?.setting_obj?.is_use_deposit == 1) {
            corp_type = dns_data?.deposit_corp_type;
        } else if (dns_data?.setting_obj?.is_use_withdraw == 1) {
            corp_type = dns_data?.withdraw_corp_type;
        }
        if (pay_type) {
            corp_type = dns_data[`${pay_type}_corp_type`];
        }
        if (corp_type == 1) {
            result = await banknersApi.vaccount_delete(data);
        }
        if (corp_type == 6) {
            result = await koreaPaySystemApi.vaccount_delete(data);
        }
        if (corp_type == 7) {
            result = await icbApi.vaccount_delete(data);
        }
        return result;
    },
    push: {
        create: async (data_) => {//푸시 url등록
            let data = data_;
            let { dns_data, pay_type } = data;
            dns_data = await getDnsData(dns_data);
            data['dns_data'] = dns_data;

            let result = default_result;
            let corp_type = dns_data?.deposit_corp_type || dns_data?.withdraw_corp_type;
            if (dns_data?.setting_obj?.is_use_deposit == 1) {
                corp_type = dns_data?.deposit_corp_type;
            } else if (dns_data?.setting_obj?.is_use_withdraw == 1) {
                corp_type = dns_data?.withdraw_corp_type;
            }
            if (pay_type) {
                corp_type = dns_data[`${pay_type}_corp_type`];
            }
            if (corp_type == 1) {
                result = await banknersApi.push.create(data);
            }
            return result;
        },
        update: async (data_) => {//푸시 url등록
            let data = data_;
            let { dns_data, pay_type } = data;
            dns_data = await getDnsData(dns_data);
            data['dns_data'] = dns_data;

            let result = default_result;
            let corp_type = dns_data?.deposit_corp_type || dns_data?.withdraw_corp_type;
            if (dns_data?.setting_obj?.is_use_deposit == 1) {
                corp_type = dns_data?.deposit_corp_type;
            } else if (dns_data?.setting_obj?.is_use_withdraw == 1) {
                corp_type = dns_data?.withdraw_corp_type;
            }
            if (pay_type) {
                corp_type = dns_data[`${pay_type}_corp_type`];
            }
            if (corp_type == 1) {
                result = await banknersApi.push.update(data);
            }
            return result;
        },
    },
    mother: {
        to: async (data_) => {//은행정보 출력
            let data = data_;
            let { dns_data, pay_type } = data;
            dns_data = await getDnsData(dns_data);
            data['dns_data'] = dns_data;
            let result = default_result;
            let corp_type = dns_data?.deposit_corp_type || dns_data?.withdraw_corp_type;
            if (dns_data?.setting_obj?.is_use_deposit == 1) {
                corp_type = dns_data?.deposit_corp_type;
            } else if (dns_data?.setting_obj?.is_use_withdraw == 1) {
                corp_type = dns_data?.withdraw_corp_type;
            }
            if (pay_type) {
                corp_type = dns_data[`${pay_type}_corp_type`];
            }
            if (corp_type == 1) {
                result = await banknersApi.mother.to(data);
            }
            return result;
        },
    },
    withdraw: {
        request: async (data_) => {//출금요청
            let data = data_;
            let { dns_data, pay_type } = data;
            dns_data = await getDnsData(dns_data);
            data['dns_data'] = dns_data;

            let result = default_result;
            let corp_type = dns_data?.deposit_corp_type || dns_data?.withdraw_corp_type;
            if (dns_data?.setting_obj?.is_use_deposit == 1) {
                corp_type = dns_data?.deposit_corp_type;
            } else if (dns_data?.setting_obj?.is_use_withdraw == 1) {
                corp_type = dns_data?.withdraw_corp_type;
            }
            if (pay_type) {
                corp_type = dns_data[`${pay_type}_corp_type`];
            }
            if (corp_type == 1) {
                result = await banknersApi.withdraw.request(data);
            }
            if (corp_type == 2) {
                result = await cooconApi.withdraw.request(data);
            }
            if (corp_type == 5) {
                result = await hectoApi.withdraw.request(data);
            }
            if (corp_type == 6) {
                result = await koreaPaySystemApi.withdraw.request(data);
            }
            return result;
        },
        request_check: async (data_) => {//출금요청
            let data = data_;
            let { dns_data, pay_type } = data;
            dns_data = await getDnsData(dns_data);
            data['dns_data'] = dns_data;

            let result = default_result;
            let corp_type = dns_data?.deposit_corp_type || dns_data?.withdraw_corp_type;
            if (dns_data?.setting_obj?.is_use_deposit == 1) {
                corp_type = dns_data?.deposit_corp_type;
            } else if (dns_data?.setting_obj?.is_use_withdraw == 1) {
                corp_type = dns_data?.withdraw_corp_type;
            }
            if (pay_type) {
                corp_type = dns_data[`${pay_type}_corp_type`];
            }

            if (corp_type == 2) {
                result = await cooconApi.withdraw.request_check(data);
            }
            if (corp_type == 5) {
                result = await hectoApi.withdraw.request_check(data);
            }
            return result;
        },
    },
    bl: {
        create: async (data_) => {//출금요청
            let data = data_;
            let { dns_data, pay_type } = data;
            dns_data = await getDnsData(dns_data);
            data['dns_data'] = dns_data;

            let result = default_result;
            let corp_type = dns_data?.deposit_corp_type || dns_data?.withdraw_corp_type;
            if (dns_data?.setting_obj?.is_use_deposit == 1) {
                corp_type = dns_data?.deposit_corp_type;
            } else if (dns_data?.setting_obj?.is_use_withdraw == 1) {
                corp_type = dns_data?.withdraw_corp_type;
            }
            if (pay_type) {
                corp_type = dns_data[`${pay_type}_corp_type`];
            }
            if (corp_type == 1) {
                result = await banknersApi.bl.create(data);
            }

            return result;
        },
        remove: async (data_) => {//출금요청
            let data = data_;
            let { dns_data, pay_type } = data;
            dns_data = await getDnsData(dns_data);
            data['dns_data'] = dns_data;

            let result = default_result;
            let corp_type = dns_data?.deposit_corp_type || dns_data?.withdraw_corp_type;
            if (dns_data?.setting_obj?.is_use_deposit == 1) {
                corp_type = dns_data?.deposit_corp_type;
            } else if (dns_data?.setting_obj?.is_use_withdraw == 1) {
                corp_type = dns_data?.withdraw_corp_type;
            }
            if (pay_type) {
                corp_type = dns_data[`${pay_type}_corp_type`];
            }
            if (corp_type == 1) {
                result = await banknersApi.bl.remove(data);
            }
            return result;
        },
    },
    pay: {
        cancel: async (data_) => {//거래취소
            let data = data_;
            let { dns_data, pay_type } = data;
            dns_data = await getDnsData(dns_data);
            data['dns_data'] = dns_data;

            let result = default_result;
            let corp_type = dns_data?.deposit_corp_type || dns_data?.withdraw_corp_type;
            if (dns_data?.setting_obj?.is_use_deposit == 1) {
                corp_type = dns_data?.deposit_corp_type;
            } else if (dns_data?.setting_obj?.is_use_withdraw == 1) {
                corp_type = dns_data?.withdraw_corp_type;
            }
            if (pay_type) {
                corp_type = dns_data[`${pay_type}_corp_type`];
            }
            if (corp_type == 1) {
                result = await banknersApi.pay.cancel(data);
            }
            return result;
        },
    },
    mcht: {
        withdraw_request: async (data_) => {//거래취소
            let data = data_;
            let { dns_data, pay_type } = data;
            dns_data = await getDnsData(dns_data);
            data['dns_data'] = dns_data;

            let result = default_result;
            let corp_type = dns_data?.deposit_corp_type || dns_data?.withdraw_corp_type;
            if (dns_data?.setting_obj?.is_use_deposit == 1) {
                corp_type = dns_data?.deposit_corp_type;
            } else if (dns_data?.setting_obj?.is_use_withdraw == 1) {
                corp_type = dns_data?.withdraw_corp_type;
            }
            if (pay_type) {
                corp_type = dns_data[`${pay_type}_corp_type`];
            }
            if (corp_type == 1) {
                result = await banknersApi.mcht.withdraw_request(data);
            }
            return result;
        },
    },
    deposit: {
        request: async (data_) => {//거래취소
            let data = data_;
            let { dns_data, pay_type } = data;
            dns_data = await getDnsData(dns_data);
            data['dns_data'] = dns_data;

            let result = default_result;
            let corp_type = dns_data?.deposit_corp_type || dns_data?.withdraw_corp_type;
            if (dns_data?.setting_obj?.is_use_deposit == 1) {
                corp_type = dns_data?.deposit_corp_type;
            } else if (dns_data?.setting_obj?.is_use_withdraw == 1) {
                corp_type = dns_data?.withdraw_corp_type;
            }
            if (pay_type) {
                corp_type = dns_data[`${pay_type}_corp_type`];
            }
            if (corp_type == 7) {
                result = await icbApi.deposit.request(data);
            }
            return result;
        },
    }
}

export default corpApi;