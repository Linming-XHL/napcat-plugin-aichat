/**
 * 消息处理器
 *
 * 处理接收到的 QQ 消息事件，包含：
 * - 命令解析与分发
 * - CD 冷却管理
 * - 消息发送工具函数
 *
 * 最佳实践：将不同类型的业务逻辑拆分到不同的 handler 文件中，
 * 保持每个文件职责单一。
 */

import type { OB11Message, OB11PostSendMsg } from 'napcat-types/napcat-onebot';
import type { NapCatPluginContext } from 'napcat-types/napcat-onebot/network/plugin/types';
import { pluginState } from '../core/state';

// ==================== CD 冷却管理 ====================

/** CD 冷却记录 key: `${groupId}:${command}`, value: 过期时间戳 */
const cooldownMap = new Map<string, number>();

/**
 * 检查是否在 CD 中
 * @returns 剩余秒数，0 表示可用
 */
function getCooldownRemaining(groupId: number | string, command: string): number {
    const cdSeconds = pluginState.config.cooldownSeconds ?? 60;
    if (cdSeconds <= 0) return 0;

    const key = `${groupId}:${command}`;
    const expireTime = cooldownMap.get(key);
    if (!expireTime) return 0;

    const remaining = Math.ceil((expireTime - Date.now()) / 1000);
    if (remaining <= 0) {
        cooldownMap.delete(key);
        return 0;
    }
    return remaining;
}

/** 设置 CD 冷却 */
function setCooldown(groupId: number | string, command: string): void {
    const cdSeconds = pluginState.config.cooldownSeconds ?? 60;
    if (cdSeconds <= 0) return;
    cooldownMap.set(`${groupId}:${command}`, Date.now() + cdSeconds * 1000);
}

// ==================== 限频管理 ====================

/** 限频记录 key: `${groupId}`, value: { count: number, resetTime: number } */
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

/**
 * 检查是否超过限频
 * @returns true 表示超过限频，false 表示未超过
 */
function checkRateLimit(groupId: string): boolean {
    const rateLimit = pluginState.config.rateLimitPerMinute ?? 10;
    if (rateLimit === -1) return false; // 禁用限频

    const now = Date.now();
    const key = groupId;
    const rateLimitInfo = rateLimitMap.get(key);

    if (!rateLimitInfo) {
        // 首次使用，初始化限频记录
        rateLimitMap.set(key, {
            count: 1,
            resetTime: now + 60 * 1000, // 1分钟后重置
        });
        return false;
    }

    // 检查是否需要重置计数
    if (now >= rateLimitInfo.resetTime) {
        rateLimitMap.set(key, {
            count: 1,
            resetTime: now + 60 * 1000,
        });
        return false;
    }

    // 检查是否超过限频
    if (rateLimitInfo.count >= rateLimit) {
        return true;
    }

    // 更新计数
    rateLimitMap.set(key, {
        count: rateLimitInfo.count + 1,
        resetTime: rateLimitInfo.resetTime,
    });
    return false;
}

// ==================== 消息历史管理 ====================

/** 消息历史记录 key: `${groupId}`, value: 消息数组 */
const messageHistoryMap = new Map<string, Array<{ role: string; content: string }>>();

/**
 * 获取指定群的消息历史
 */
function getMessageHistory(groupId: string): Array<{ role: string; content: string }> {
    return messageHistoryMap.get(groupId) || [];
}

/**
 * 添加消息到历史记录
 */
function addMessageToHistory(groupId: string, role: string, content: string): void {
    const history = getMessageHistory(groupId);
    history.push({ role, content });
    messageHistoryMap.set(groupId, history);
}

/**
 * 清空指定群的消息历史
 */
function clearMessageHistory(groupId: string): void {
    messageHistoryMap.delete(groupId);
}

// ==================== 消息发送工具 ====================

/**
 * 发送消息（通用）
 * 根据消息类型自动发送到群或私聊
 *
 * @param ctx 插件上下文
 * @param event 原始消息事件（用于推断回复目标）
 * @param message 消息内容（支持字符串或消息段数组）
 */
export async function sendReply(
    ctx: NapCatPluginContext,
    event: OB11Message,
    message: OB11PostSendMsg['message']
): Promise<boolean> {
    try {
        const params: OB11PostSendMsg = {
            message,
            message_type: event.message_type,
            ...(event.message_type === 'group' && event.group_id
                ? { group_id: String(event.group_id) }
                : {}),
            ...(event.message_type === 'private' && event.user_id
                ? { user_id: String(event.user_id) }
                : {}),
        };
        await ctx.actions.call('send_msg', params, ctx.adapterName, ctx.pluginManager.config);
        return true;
    } catch (error) {
        pluginState.logger.error('发送消息失败:', error);
        return false;
    }
}

/**
 * 发送群消息
 */
export async function sendGroupMessage(
    ctx: NapCatPluginContext,
    groupId: number | string,
    message: OB11PostSendMsg['message']
): Promise<boolean> {
    try {
        const params: OB11PostSendMsg = {
            message,
            message_type: 'group',
            group_id: String(groupId),
        };
        await ctx.actions.call('send_msg', params, ctx.adapterName, ctx.pluginManager.config);
        return true;
    } catch (error) {
        pluginState.logger.error('发送群消息失败:', error);
        return false;
    }
}

/**
 * 发送私聊消息
 */
export async function sendPrivateMessage(
    ctx: NapCatPluginContext,
    userId: number | string,
    message: OB11PostSendMsg['message']
): Promise<boolean> {
    try {
        const params: OB11PostSendMsg = {
            message,
            message_type: 'private',
            user_id: String(userId),
        };
        await ctx.actions.call('send_msg', params, ctx.adapterName, ctx.pluginManager.config);
        return true;
    } catch (error) {
        pluginState.logger.error('发送私聊消息失败:', error);
        return false;
    }
}

// ==================== 合并转发消息 ====================

/** 合并转发消息节点 */
export interface ForwardNode {
    type: 'node';
    data: {
        nickname: string;
        user_id?: string;
        content: Array<{ type: string; data: Record<string, unknown> }>;
    };
}

/**
 * 发送合并转发消息
 * @param ctx 插件上下文
 * @param target 群号或用户 ID
 * @param isGroup 是否为群消息
 * @param nodes 合并转发节点列表
 */
export async function sendForwardMsg(
    ctx: NapCatPluginContext,
    target: number | string,
    isGroup: boolean,
    nodes: ForwardNode[],
): Promise<boolean> {
    try {
        const actionName = isGroup ? 'send_group_forward_msg' : 'send_private_forward_msg';
        const params: Record<string, unknown> = { message: nodes };
        if (isGroup) {
            params.group_id = String(target);
        } else {
            params.user_id = String(target);
        }
        await ctx.actions.call(
            actionName as 'send_group_forward_msg',
            params as never,
            ctx.adapterName,
            ctx.pluginManager.config,
        );
        return true;
    } catch (error) {
        pluginState.logger.error('发送合并转发消息失败:', error);
        return false;
    }
}

// ==================== 权限检查 ====================

/**
 * 检查群聊中是否有管理员权限
 * 私聊消息默认返回 true
 */
export function isAdmin(event: OB11Message): boolean {
    if (event.message_type !== 'group') return true;
    const role = (event.sender as Record<string, unknown>)?.role;
    return role === 'admin' || role === 'owner';
}

/**
 * 检查是否是主人QQ
 * @returns true 表示是主人QQ，false 表示不是
 */
function isMaster(userId: string): boolean {
    const masterQqs = pluginState.config.masterQqs || [];
    return masterQqs.includes(userId);
}

/**
 * 检查是否有权限管理AI功能
 * @returns true 表示有权限，false 表示没有
 */
function hasAIManagePermission(event: OB11Message): boolean {
    // 检查是否是群主或管理员
    if (isAdmin(event)) return true;
    
    // 检查是否是主人QQ
    if (event.user_id) {
        return isMaster(String(event.user_id));
    }
    
    return false;
}

// ==================== AI 聊天核心逻辑 ====================

/**
 * 检查消息是否@了机器人
 * @returns true 表示@了机器人，false 表示没有
 */
function isAtBot(event: OB11Message): boolean {
    if (!event.message) return false;
    
    // 检查消息段是否包含@机器人的部分
    const messageSegments = Array.isArray(event.message) ? event.message : [];
    const selfId = pluginState.selfId;
    
    return messageSegments.some(segment => {
        if (segment.type === 'at' && segment.data && segment.data.qq) {
            // 检查是否@了机器人自己
            return String(segment.data.qq) === selfId;
        }
        return false;
    });
}

/**
 * 提取用户的问题（去除@机器人的部分）
 */
function extractQuestion(event: OB11Message): string {
    if (!event.message) return '';
    
    const messageSegments = Array.isArray(event.message) ? event.message : [];
    let question = '';
    
    messageSegments.forEach(segment => {
        if (segment.type === 'text' && segment.data && segment.data.text) {
            question += segment.data.text;
        }
    });
    
    return question.trim();
}

/**
 * 调用AI API获取回复
 */
async function getAIResponse(groupId: string, question: string): Promise<string> {
    const { aiApiUrl, aiApiKey, aiModel, aiSystemPrompt, aiContextLength, debug } = pluginState.config;
    
    if (!aiApiUrl || !aiApiKey) {
        pluginState.logger.error('AI API配置不完整: aiApiUrl=' + !!aiApiUrl + ', aiApiKey=' + !!aiApiKey);
        return '请先在控制台配置AI API地址和API Key';
    }
    
    try {
        if (debug) {
            pluginState.logger.debug('开始调用AI API:', { aiApiUrl, aiModel, aiContextLength });
        }
        
        // 获取消息历史
        const history = getMessageHistory(groupId);
        // 限制历史消息条数
        const limitedHistory = history.slice(-aiContextLength);
        
        // 构建消息数组
        const messages: Array<{ role: string; content: string }> = [
            {
                role: 'system',
                content: aiSystemPrompt || '你是一个智能助手，帮助用户解答问题。',
            },
            ...limitedHistory,
            {
                role: 'user',
                content: question,
            },
        ];
        
        const response = await fetch(aiApiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${aiApiKey}`,
            },
            body: JSON.stringify({
                model: aiModel,
                messages,
                temperature: 0.7,
            }),
        });
        
        if (debug) {
            pluginState.logger.debug('AI API响应状态:', response.status);
        }
        
        if (!response.ok) {
            const errorText = await response.text();
            pluginState.logger.error('AI API请求失败:', { status: response.status, statusText: response.statusText, body: errorText });
            return `AI API请求失败 (${response.status}): ${response.statusText}`;
        }
        
        const data = await response.json();
        
        if (debug) {
            pluginState.logger.debug('AI API响应数据:', JSON.stringify(data));
        }
        
        if (data.error) {
            pluginState.logger.error('AI API返回错误:', data.error);
            return `AI API错误: ${data.error.message || JSON.stringify(data.error)}`;
        }
        
        if (data.choices && data.choices.length > 0) {
            const reply = data.choices[0].message.content;
            if (debug) {
                pluginState.logger.debug('AI回复成功，长度:', reply.length);
            }
            return reply;
        }
        
        pluginState.logger.error('AI API响应格式异常:', data);
        return 'AI回复失败，请稍后再试';
    } catch (error) {
        pluginState.logger.error('调用AI API失败:', error);
        return `AI回复失败: ${error instanceof Error ? error.message : String(error)}`;
    }
}

// ==================== 消息处理主函数 ====================

/**
 * 消息处理主函数
 * 在这里实现你的命令处理逻辑
 */
export async function handleMessage(ctx: NapCatPluginContext, event: OB11Message): Promise<void> {
    try {
        const rawMessage = event.raw_message || '';
        const messageType = event.message_type;
        const groupId = event.group_id;
        const userId = event.user_id;

        pluginState.ctx.logger.debug(`收到消息: ${rawMessage} | 类型: ${messageType}`);

        // 只允许群聊使用
        if (messageType !== 'group' || !groupId) return;

        // 群消息：检查该群是否启用
        if (!pluginState.isGroupEnabled(String(groupId))) return;

        // 检查群是否启用了AI功能
        const groupConfig = pluginState.config.groupConfigs[String(groupId)];
        if (groupConfig && groupConfig.aiEnabled === false) return;

        // 检查是否是其他插件的命令（优先级低于其他插件）
        // 如果消息以命令前缀开始，可能是其他插件的命令，直接返回
        const prefix = pluginState.config.commandPrefix || '#cmd';
        if (rawMessage.startsWith(prefix)) {
            // 解析命令参数
            const args = rawMessage.slice(prefix.length).trim().split(/\s+/);
            const subCommand = args[0]?.toLowerCase() || '';

            switch (subCommand) {
                case 'help': {
                    const helpText = [
                        `[= 插件帮助 =]`,
                        `${prefix} help - 显示帮助信息`,
                        `${prefix} ping - 测试连通性`,
                        `${prefix} status - 查看运行状态`,
                        `${prefix} ai enable - 启用AI功能`,
                        `${prefix} ai disable - 禁用AI功能`,
                    ].join('\n');
                    await sendReply(ctx, event, helpText);
                    break;
                }

                case 'ping': {
                    // 群消息检查 CD
                    if (messageType === 'group' && groupId) {
                        const remaining = getCooldownRemaining(groupId, 'ping');
                        if (remaining > 0) {
                            await sendReply(ctx, event, `请等待 ${remaining} 秒后再试`);
                            return;
                        }
                    }

                    await sendReply(ctx, event, 'pong!');
                    if (messageType === 'group' && groupId) setCooldown(groupId, 'ping');
                    pluginState.incrementProcessed();
                    break;
                }

                case 'status': {
                    const statusText = [
                        `[= 插件状态 =]`,
                        `运行时长: ${pluginState.getUptimeFormatted()}`,
                        `今日处理: ${pluginState.stats.todayProcessed}`,
                        `总计处理: ${pluginState.stats.processed}`,
                    ].join('\n');
                    await sendReply(ctx, event, statusText);
                    break;
                }

                case 'ai': {
                    // 处理AI相关命令
                    const aiSubCommand = args[1]?.toLowerCase() || '';
                    switch (aiSubCommand) {
                        case 'enable':
                        case 'disable': {
                            // 检查权限
                            if (!hasAIManagePermission(event)) {
                                await sendReply(ctx, event, '你没有权限管理AI功能');
                                return;
                            }

                            // 切换AI功能状态
                            const groupIdStr = String(groupId);
                            const newAiEnabled = aiSubCommand === 'enable';

                            // 更新群配置并保存
                            pluginState.updateGroupConfig(groupIdStr, { aiEnabled: newAiEnabled });

                            // 发送回复
                            await sendReply(ctx, event, `AI功能已${newAiEnabled ? '启用' : '禁用'}`);
                            break;
                        }
                    }
                    break;
                }

                default: {
                    // 其他命令，可能是其他插件的，直接返回
                    return;
                }
            }
            return;
        }

        // 检查是否@了机器人
        if (!isAtBot(event)) return;

        // 检查发送者是否在黑名单中
        if (pluginState.config.blacklistQqs.includes(String(userId))) {
            pluginState.ctx.logger.debug(`用户 ${userId} 在黑名单中，忽略消息`);
            return;
        }

        // 检查消息内容是否匹配屏蔽词正则表达式
        if (pluginState.config.blockedPatterns.length > 0) {
            const messageContent = rawMessage || '';
            for (const pattern of pluginState.config.blockedPatterns) {
                try {
                    if (new RegExp(pattern).test(messageContent)) {
                        pluginState.ctx.logger.debug(`消息包含屏蔽词模式 "${pattern}"，忽略消息`);
                        return;
                    }
                } catch (error) {
                    pluginState.ctx.logger.warn(`正则表达式 "${pattern}" 无效:`, error);
                }
            }
        }

        // 检查消息是否被其他插件处理过（通过检查消息中是否包含其他插件的特征）
        // 这里可以根据实际情况添加更多检查逻辑
        // 例如检查消息是否包含其他插件的命令前缀
        
        // 提取用户的问题
        const question = extractQuestion(event);
        if (!question) return;

        // 检查限频
        if (checkRateLimit(String(groupId))) {
            await sendReply(ctx, event, '当前请求过于频繁，请稍后再试');
            return;
        }

        // 调用AI API获取回复
        const aiResponse = await getAIResponse(String(groupId), question);

        // 发送回复
        await sendReply(ctx, event, aiResponse);
        
        // 保存消息历史
        addMessageToHistory(String(groupId), 'user', question);
        addMessageToHistory(String(groupId), 'assistant', aiResponse);
        
        pluginState.incrementProcessed();
    } catch (error) {
        pluginState.logger.error('处理消息时出错:', error);
    }
}
