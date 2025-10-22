/**
 * 错误码管理模块
 * 统一管理所有错误码和对应的错误信息
 */

class ErrorCodeManager {
    constructor() {
        // 错误码映射表
        this.errorCodes = {
            // WebApi接口相关错误
            '-81001': 'WebApi接口不存在',
            '-81003': '软件已被强制关闭',
            '-81004': '软件不存在',
            '-81005': '软件已停用',
            '-81006': '版本号不存在',
            '-81007': '程序接口密码错误',
            '-81008': '程序不允许用户转绑',
            '-81009': '软件已开启收费模式,当前版本为免费版本',
            '-81010': '版本号已停用',
            '-81011': '软件版本必须为数字',
            '-81012': '当前软件未开启试用功能',
            '-81015': '频繁调用,请等待10分钟后再做尝试',
            '-81016': '单IP频繁访问限制',
            '-81017': '此接口开启了算法,但是提交时未加密数据再提交',
            '-81018': '变量数据不存在',
            '-81019': '变量ID必须为数字',
            '-81020': '变量别名只能是数字或者字母或者数字字母混合',
            '-81021': '错误的调用方式,请查看后台接口的调用方式和参数',
            '-81022': '机器码填写错误，长度必须是不能超过32位的字母或数字',
            '-81023': '请先登陆后再调用此方法或账号已被顶下线',
            '-81024': '扣点数量必须大于0',
            '-81025': '软件扣费模式和卡类不符',
            '-81026': '当前扣费模式为时间计费,无法使用扣点功能',
            '-81027': '黑名单已存在',
            '-81028': '当前用户在别的机器登陆使用,暂时无法登陆 请等10分钟',
            '-81029': '当前用户在别的IP登陆使用,暂时无法登陆 请等10分钟',
            '-81030': '当前用户已超过最大登陆数量,暂时无法登陆 请等10分钟',
            '-81031': '用户已在别的地方登陆',
            '-81032': 'token填写错误,长度必须是16位字母或数字',
            '-81033': '用户名或单码或试用特征填写错误,长度必须是6-16位的字母或数字',
            '-81035': '解绑类型只能为数字并且只能为1或者2',
            '-81036': '用户名或单码或试用特征使用点数不足',
            '-81037': '当前版本不是最新版本,已被停止使用',
            '-81039': '用户电脑特征已被列入黑名单',
            '-81040': '检测用户状态过于频繁，请把检测周期设置大于等于3分钟',
            '-81042': '用户或卡密提交的云数据超过最大长度',
            '-81043': '用户或卡密提交的封停原因超过最大长度',
            '-81044': '提交的加入黑名单原因超过最大长度',
            '-81045': 'VMP授权密钥设置错误,请查看管理端对应的设置要求进行设置',
            '-81047': '提交的VMP机器码格式错误,长度不能小于10且不能大于200',
            '-81048': 'VMP授权端校验失败',
            '-81049': '取用户指定类型数据错误',
            '-81055': '封包已过期或软件算法不匹配或设置返回的内容存在乱码',
            '-81060': '超过最大可激活用户数,请升级套餐',
            '-81061': '当前软件线路过于拥挤,请稍等10分钟后再尝试登录使用',
            '-81062': '当前软件位已到期',
            '-81063': '开发者账号余额不足',
            '-81064': '开发者账号会员已到期',
            '-81065': '当前免费服务器线路过于拥挤,请稍等10分钟后再尝试登录使用或升级VIP服务器线路',
            '-81066': '权限不足,当前云加密功能需要VIP套餐3及以上才能使用',
            '-81067': '扣除的时间数量必须大于0',
            '-81068': '当前扣费模式为点数计费,无法使用扣除时间功能',
            '-81069': '用户名或单码或试用特征使用时间不足',
            '-81070': '算法ID只能是数字或字母或数字字母混合',
            '-81071': '算法别名只能是数字或字母或数字字母混合',
            '-81072': '算法不存在或该算法不属于当前软件',
            '-81073': '远程算法请求超时已被临时停用,请确认没问题后再重新开启',
            '-81074': '远程算法服务器故障,如多次出现请联系平台作者',
            '-81075': '远程算法服务器故障,如多次出现请联系平台作者',
            '-81076': '您当前远程算法服务器请求超时,请检查远程算法服务器',
            '-81077': '您当前远程算法服务器连接超时,请检查远程算法服务器',
            '-81078': '远程算法返回内容长度超过规定最大长度',
            '-81079': '远程算法返回的内容不能为空',
            
            // 单码相关错误
            '-83001': '单码不存在',
            '-83002': '单码填写错误,长度应16位',
            '-83003': '单码已被锁定',
            '-83004': '单码类型和软件扣费模式不符',
            '-83005': '该单码所属卡类为单次卡类每个电脑只能登陆使用一张',
            '-83006': '单码已到期',
            '-83007': '单码使用点数不足',
            '-83008': '单码未在绑定的电脑上登陆',
            '-83009': '单码未在绑定的IP地址登陆',
            '-83011': '单码重绑次数超过限制',
            '-83012': '单码积分不足',
            '-83013': '单码卡密未激活',
            '-83014': '单码IP一致无需转绑即可登陆',
            '-83015': '单码机器码一致无需转绑即可登陆',
            '-83016': '单码转绑后将到期',
            '-83017': '单码转绑后点数小于0',
            '-83018': '单码不存在或试用特征不存在或此前已被封禁',
            
            // 用户相关错误
            '-82001': '用户不存在',
            '-82002': '用户名填写错误,长度必须是6-16位字母或数字',
            '-82003': '用户密码填写错误,长度必须是6-16位字母或数字',
            '-82004': '用户超级密码填写错误,长度必须是6-16位字母或数字',
            '-82005': '用户名已存在',
            '-82006': '用户已被锁定',
            '-82007': '用户已到期',
            '-82008': '用户使用点数不足',
            '-82009': '用户未在绑定的电脑上登陆',
            '-82010': '用户未在绑定的IP地址登陆',
            '-82011': '用户注册次数超过限制',
            '-82012': '用户重绑次数超过限制',
            '-82013': '用户积分不足',
            '-82014': '用户IP一致无需转绑即可登陆',
            '-82015': '用户机器码一致无需转绑即可登陆',
            '-82016': '用户注册失败，程序停止新用户注册',
            '-82017': '用户注册失败，已开启卡密注册',
            '-82018': '用户超级密码错误',
            '-82019': '用户转绑后将到期',
            '-82020': '用户转绑后点数小于0',
            '-82021': '用户密码错误',
            '-82022': '推荐人填写错误,长度必须是6-16位字母或数字',
            '-82023': '超过最大用户数量，联系管理员升级',
            '-82024': '用户不存在或者密码错误或此前已被封禁',
            
            // 充值卡密相关错误
            '-84001': '充值卡密填写错误,长度等于16位',
            '-84002': '充值卡密不存在',
            '-84003': '充值卡密已被使用',
            '-84004': '充值卡密已被锁定',
            '-84005': '该卡密所属卡类为单次卡类每个用户只能充值一张',
            
            // 试用相关错误
            '-85001': '试用积分不足',
            '-85002': '试用特征不存在',
            '-85003': '试用特征已锁定',
            '-85004': '试用特征无此数据',
            '-85005': '试用特征已到期',
            '-85006': '试用特征使用点数不足',
            '-85007': '试用特征填写错误,长度必须是6-16位字母或数字',
            
            // 网络和系统错误
            'NETWORK_ERROR': '网络连接错误，请检查网络连接',
            'TIMEOUT_ERROR': '请求超时，请稍后重试',
            'PARSE_ERROR': '数据解析错误',
            'UNKNOWN_ERROR': '未知错误，请联系系统管理员'
        };
    }
    
    /**
     * 根据错误码获取错误信息
     * @param {string} errorCode - 错误码
     * @param {string} defaultMessage - 默认错误信息（可选）
     * @returns {string} 错误信息
     */
    getErrorMessage(errorCode, defaultMessage = null) {
        if (this.errorCodes[errorCode]) {
            return this.errorCodes[errorCode];
        }
        
        return defaultMessage || `未知错误码: ${errorCode}`;
    }
    
    /**
     * 检查错误码是否存在
     * @param {string} errorCode - 错误码
     * @returns {boolean} 是否存在
     */
    hasErrorCode(errorCode) {
        return this.errorCodes.hasOwnProperty(errorCode);
    }
    
    /**
     * 获取所有错误码
     * @returns {Array} 错误码列表
     */
    getAllErrorCodes() {
        return Object.keys(this.errorCodes);
    }
    
    /**
     * 获取错误码分类统计
     * @returns {Object} 分类统计信息
     */
    getErrorCodeStats() {
        const stats = {
            total: Object.keys(this.errorCodes).length,
            categories: {
                webApi: 0,
                singleCode: 0,
                user: 0,
                recharge: 0,
                trial: 0,
                system: 0
            }
        };
        
        Object.keys(this.errorCodes).forEach(code => {
            if (code.startsWith('-81')) {
                stats.categories.webApi++;
            } else if (code.startsWith('-83')) {
                stats.categories.singleCode++;
            } else if (code.startsWith('-82')) {
                stats.categories.user++;
            } else if (code.startsWith('-84')) {
                stats.categories.recharge++;
            } else if (code.startsWith('-85')) {
                stats.categories.trial++;
            } else {
                stats.categories.system++;
            }
        });
        
        return stats;
    }
    
    /**
     * 格式化错误输出
     * @param {string} errorCode - 错误码
     * @param {string} additionalInfo - 附加信息（可选）
     * @returns {Object} 格式化错误对象
     */
    formatError(errorCode, additionalInfo = '') {
        const message = this.getErrorMessage(errorCode);
        
        return {
            success: false,
            errorCode: errorCode,
            errorMessage: message,
            additionalInfo: additionalInfo,
            timestamp: new Date().toISOString()
        };
    }
    
    /**
     * 批量获取错误信息
     * @param {Array} errorCodes - 错误码数组
     * @returns {Array} 错误信息数组
     */
    getBatchErrorMessages(errorCodes) {
        return errorCodes.map(code => ({
            errorCode: code,
            errorMessage: this.getErrorMessage(code)
        }));
    }
}

// 创建全局实例
const errorCodeManager = new ErrorCodeManager();

/**
 * 便捷函数：获取错误信息
 * @param {string} errorCode - 错误码
 * @returns {string} 错误信息
 */
function getErrorMessage(errorCode) {
    return errorCodeManager.getErrorMessage(errorCode);
}

/**
 * 便捷函数：格式化错误输出
 * @param {string} errorCode - 错误码
 * @param {string} additionalInfo - 附加信息
 * @returns {Object} 格式化错误对象
 */
function formatError(errorCode, additionalInfo = '') {
    return errorCodeManager.formatError(errorCode, additionalInfo);
}

/**
 * 便捷函数：检查错误码是否存在
 * @param {string} errorCode - 错误码
 * @returns {boolean} 是否存在
 */
function hasErrorCode(errorCode) {
    return errorCodeManager.hasErrorCode(errorCode);
}

// 导出模块
module.exports = {
    ErrorCodeManager,
    errorCodeManager,
    getErrorMessage,
    formatError,
    hasErrorCode
};