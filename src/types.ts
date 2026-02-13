/**
 * 类型定义文件
 * 定义插件内部使用的接口和类型
 *
 * 注意：OneBot 相关类型（OB11Message, OB11PostSendMsg 等）
 * 以及插件框架类型（NapCatPluginContext, PluginModule 等）
 * 均来自 napcat-types 包，无需在此重复定义。
 */

// ==================== 插件配置 ====================

/**
 * 插件主配置接口
 * 在此定义你的插件所需的所有配置项
 */
export interface PluginConfig {
    /** 全局开关：是否启用插件功能 */
    enabled: boolean;
    /** 调试模式：启用后输出详细日志 */
    debug: boolean;
    /** 触发命令前缀，默认为 #cmd */
    commandPrefix: string;
    /** 同一命令请求冷却时间（秒），0 表示不限制 */
    cooldownSeconds: number;
    /** 按群的单独配置 */
    groupConfigs: Record<string, GroupConfig>;
    /** AI服务类型：openai 或 tencent */
    aiServiceType: 'openai' | 'tencent';
    /** OpenAI API 地址 */
    aiApiUrl: string;
    /** OpenAI API Key */
    aiApiKey: string;
    /** OpenAI 模型名称 */
    aiModel: string;
    /** 腾讯云AI 应用密钥 */
    tencentBotAppKey: string;
    /** 腾讯云AI 访客ID前缀 */
    tencentVisitorBizIdPrefix: string;
    /** 限频设置：一分钟最大调用次数，-1 表示禁用 */
    rateLimitPerMinute: number;
    /** 主人QQ列表：额外配置的可以禁用或启用AI功能的QQ */
    masterQqs: string[];
    /** 黑名单QQ列表：这些QQ发送的消息不会被AI回应 */
    blacklistQqs: string[];
    /** 屏蔽词正则表达式列表：包含这些模式的消息不会被AI回应 */
    blockedPatterns: string[];
    /** AI 系统提示词 */
    aiSystemPrompt: string;
    /** 上下文消息条数，范围2-30 */
    aiContextLength: number;
}

/**
 * 群配置
 */
export interface GroupConfig {
    /** 是否启用此群的功能 */
    enabled?: boolean;
    /** 是否启用此群的AI功能 */
    aiEnabled?: boolean;
    /** 群级别限频设置：一分钟最大调用次数，-1 表示禁用 */
    rateLimitPerMinute?: number;
}

// ==================== API 响应 ====================

/**
 * 统一 API 响应格式
 */
export interface ApiResponse<T = unknown> {
    /** 状态码，0 表示成功，-1 表示失败 */
    code: number;
    /** 错误信息（仅错误时返回） */
    message?: string;
    /** 响应数据（仅成功时返回） */
    data?: T;
}
