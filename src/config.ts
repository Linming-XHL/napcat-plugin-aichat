/**
 * 插件配置模块
 * 定义默认配置值和 WebUI 配置 Schema
 */

import type { NapCatPluginContext, PluginConfigSchema } from 'napcat-types/napcat-onebot/network/plugin/types';
import type { PluginConfig } from './types';

/** 默认配置 */
export const DEFAULT_CONFIG: PluginConfig = {
    enabled: true,
    debug: false,
    commandPrefix: '#cmd',
    cooldownSeconds: 60,
    groupConfigs: {},
    // AI聊天相关配置
    aiApiUrl: 'https://api.openai.com/v1/chat/completions',
    aiApiKey: '',
    aiModel: 'gpt-3.5-turbo',
    rateLimitPerMinute: 10,
    masterQqs: [],
};

/**
 * 构建 WebUI 配置 Schema
 *
 * 使用 ctx.NapCatConfig 提供的构建器方法生成配置界面：
 *   - boolean(key, label, defaultValue?, description?, reactive?)  → 开关
 *   - text(key, label, defaultValue?, description?, reactive?)     → 文本输入
 *   - number(key, label, defaultValue?, description?, reactive?)   → 数字输入
 *   - select(key, label, options, defaultValue?, description?)     → 下拉单选
 *   - multiSelect(key, label, options, defaultValue?, description?) → 下拉多选
 *   - html(content)     → 自定义 HTML 展示（不保存值）
 *   - plainText(content) → 纯文本说明
 *   - combine(...items)  → 组合多个配置项为 Schema
 */
export function buildConfigSchema(ctx: NapCatPluginContext): PluginConfigSchema {
    return ctx.NapCatConfig.combine(
        // 插件信息头部
        ctx.NapCatConfig.html(`
            <div style="padding: 16px; background: #FB7299; border-radius: 12px; margin-bottom: 20px; color: white;">
                <h3 style="margin: 0 0 6px 0; font-size: 18px; font-weight: 600;">AI聊天插件</h3>
                <p style="margin: 0; font-size: 13px; opacity: 0.85;">为NapCat添加AI聊天功能，支持@触发和群聊限频</p>
            </div>
        `),
        // 全局开关
        ctx.NapCatConfig.boolean('enabled', '启用插件', true, '是否启用此插件的功能'),
        // 调试模式
        ctx.NapCatConfig.boolean('debug', '调试模式', false, '启用后将输出详细的调试日志'),
        // 命令前缀
        ctx.NapCatConfig.text('commandPrefix', '命令前缀', '#cmd', '触发命令的前缀，默认为 #cmd'),
        // 冷却时间
        ctx.NapCatConfig.number('cooldownSeconds', '冷却时间（秒）', 60, '同一命令请求冷却时间，0 表示不限制'),
        // AI API 配置
        ctx.NapCatConfig.html(`
            <div style="padding: 16px; background: #f0f0f0; border-radius: 12px; margin: 20px 0;">
                <h4 style="margin: 0 0 12px 0; font-size: 16px; font-weight: 600;">AI API 配置</h4>
            </div>
        `),
        // AI API 地址
        ctx.NapCatConfig.text('aiApiUrl', 'API 地址', 'https://api.openai.com/v1/chat/completions', 'AI服务的API地址'),
        // AI API Key
        ctx.NapCatConfig.text('aiApiKey', 'API Key', '', 'AI服务的API密钥'),
        // AI 模型名称
        ctx.NapCatConfig.text('aiModel', '模型名称', 'gpt-3.5-turbo', '使用的AI模型名称'),
        // 限频设置
        ctx.NapCatConfig.number('rateLimitPerMinute', '限频设置（次/分钟）', 10, '一分钟最大调用次数，-1 表示禁用'),
        // 主人QQ列表
        ctx.NapCatConfig.text('masterQqs', '主人QQ列表', '', '额外配置的可以禁用或启用AI功能的QQ，多个用逗号分隔')
    );
}
