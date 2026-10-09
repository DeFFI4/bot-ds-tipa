const {
  ChannelType,
  PermissionFlagsBits,
  EmbedBuilder
} = require('discord.js');
const { LOG_CHANNEL_NAME, MOD_ROLE_ID, COLORS } = require('../config');

/**
 * Находит существующий канал логов или создает новый со скрытыми правами
 * @param {import('discord.js').Guild} guild
 * @returns {Promise<import('discord.js').TextChannel|null>}
 */
async function getOrCreateLogChannel(guild) {
  if (!guild) return null;

  try {
    // 1. Поиск существующего канала (без учета регистра)
    let channel = guild.channels.cache.find(
      (c) => c.type === ChannelType.GuildText && c.name.toLowerCase() === LOG_CHANNEL_NAME.toLowerCase()
    );

    if (channel) return channel;

    // 2. Если нет в кэше, пробуем подтянуть список каналов
    const fetched = await guild.channels.fetch();
    channel = fetched.find(
      (c) => c && c.type === ChannelType.GuildText && c.name.toLowerCase() === LOG_CHANNEL_NAME.toLowerCase()
    );
    if (channel) return channel;

    // 3. Формируем права для нового канала
    const permissionOverwrites = [
      {
        id: guild.id, // @everyone
        deny: [PermissionFlagsBits.ViewChannel]
      },
      {
        id: guild.client.user.id, // бот
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.EmbedLinks,
          PermissionFlagsBits.AttachFiles,
          PermissionFlagsBits.ReadMessageHistory
        ]
      }
    ];

    // Добавляем права для роли модератора, если она существует в гильдии
    const modRole = guild.roles.cache.get(MOD_ROLE_ID);
    if (modRole) {
      permissionOverwrites.push({
        id: MOD_ROLE_ID,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.ReadMessageHistory
        ]
      });
    }

    // 4. Создание канала
    channel = await guild.channels.create({
      name: LOG_CHANNEL_NAME,
      type: ChannelType.GuildText,
      topic: '🔒 Официальный журнал аудита и модерации Lounge',
      permissionOverwrites
    });

    // Отправляем приветственное сообщение в новый канал логов
    const initEmbed = new EmbedBuilder()
      .setColor(COLORS.INFO)
      .setTitle('🛡️ Канал аудита инициализирован')
      .setDescription(`Канал **#${LOG_CHANNEL_NAME}** успешно создан и сконфигурирован. Сюда будут автоматически отправляться все действия модерации.`)
      .addFields(
        { name: '👥 Доступ', value: `Администраторы сервера + Роль модератора <@&${MOD_ROLE_ID}>`, inline: true },
        { name: '🕒 Время создания', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true }
      )
      .setTimestamp();

    await channel.send({ embeds: [initEmbed] });

    return channel;
  } catch (err) {
    console.error(`[Logger] Ошибка при создании/поиске канала ${LOG_CHANNEL_NAME}:`, err);
    return null;
  }
}

/**
 * Базовый метод отправки Embed в канал логов
 * @param {import('discord.js').Guild} guild
 * @param {import('discord.js').EmbedBuilder} embed
 */
async function sendLog(guild, embed) {
  try {
    const channel = await getOrCreateLogChannel(guild);
    if (!channel) {
      console.warn(`[Logger] Не удалось получить канал логов для сервера ${guild.name}`);
      return false;
    }
    await channel.send({ embeds: [embed] });
    return true;
  } catch (err) {
    console.error(`[Logger] Ошибка при отправке лога в гильдию ${guild.name}:`, err);
    return false;
  }
}

/**
 * Логирование бана
 */
async function logBan(guild, { moderator, target, reason, deleteDays }) {
  const embed = new EmbedBuilder()
    .setColor(COLORS.DANGER)
    .setTitle('🔨 Блокировка участника (Ban)')
    .setThumbnail(target.displayAvatarURL ? target.displayAvatarURL({ dynamic: true }) : null)
    .addFields(
      { name: '👤 Нарушитель', value: `${target.tag || target.username || 'Пользователь'} (<@${target.id}>)`, inline: true },
      { name: '🛡️ Модератор', value: `${moderator.tag || moderator.username} (<@${moderator.id}>)`, inline: true },
      { name: '🗑️ Очистка сообщений', value: `${deleteDays || 0} дн.`, inline: true },
      { name: '📄 Причина', value: reason || 'Причина не указана', inline: false }
    )
    .setFooter({ text: `ID цели: ${target.id}` })
    .setTimestamp();

  return sendLog(guild, embed);
}

/**
 * Логирование кика
 */
async function logKick(guild, { moderator, target, reason }) {
  const embed = new EmbedBuilder()
    .setColor(COLORS.WARNING)
    .setTitle('👢 Исключение участника (Kick)')
    .setThumbnail(target.displayAvatarURL ? target.displayAvatarURL({ dynamic: true }) : null)
    .addFields(
      { name: '👤 Нарушитель', value: `${target.tag || target.username || 'Пользователь'} (<@${target.id}>)`, inline: true },
      { name: '🛡️ Модератор', value: `${moderator.tag || moderator.username} (<@${moderator.id}>)`, inline: true },
      { name: '📄 Причина', value: reason || 'Причина не указана', inline: false }
    )
    .setFooter({ text: `ID цели: ${target.id}` })
    .setTimestamp();

  return sendLog(guild, embed);
}

/**
 * Логирование мута (тайм-аута)
 */
async function logMute(guild, { moderator, target, duration, reason }) {
  const embed = new EmbedBuilder()
    .setColor(COLORS.WARNING)
    .setTitle('🔇 Тайм-аут (Mute)')
    .setThumbnail(target.displayAvatarURL ? target.displayAvatarURL({ dynamic: true }) : null)
    .addFields(
      { name: '👤 Нарушитель', value: `${target.tag || target.username || 'Пользователь'} (<@${target.id}>)`, inline: true },
      { name: '🛡️ Модератор', value: `${moderator.tag || moderator.username} (<@${moderator.id}>)`, inline: true },
      { name: '⏱️ Длительность', value: `${duration}`, inline: true },
      { name: '📄 Причина', value: reason || 'Причина не указана', inline: false }
    )
    .setFooter({ text: `ID цели: ${target.id}` })
    .setTimestamp();

  return sendLog(guild, embed);
}

/**
 * Логирование снятия мута (тайм-аута)
 */
async function logUnmute(guild, { moderator, target, reason }) {
  const embed = new EmbedBuilder()
    .setColor(COLORS.SUCCESS)
    .setTitle('🔊 Досрочное снятие тайм-аута (Unmute)')
    .setThumbnail(target.displayAvatarURL ? target.displayAvatarURL({ dynamic: true }) : null)
    .addFields(
      { name: '👤 Пользователь', value: `${target.tag || target.username || 'Пользователь'} (<@${target.id}>)`, inline: true },
      { name: '🛡️ Модератор', value: `${moderator.tag || moderator.username} (<@${moderator.id}>)`, inline: true },
      { name: '📄 Причина', value: reason || 'Досрочная разблокировка', inline: false }
    )
    .setFooter({ text: `ID цели: ${target.id}` })
    .setTimestamp();

  return sendLog(guild, embed);
}

/**
 * Логирование предупреждения
 */
async function logWarn(guild, { moderator, target, reason }) {
  const embed = new EmbedBuilder()
    .setColor(COLORS.WARNING)
    .setTitle('⚠️ Официальное предупреждение (Warn)')
    .setThumbnail(target.displayAvatarURL ? target.displayAvatarURL({ dynamic: true }) : null)
    .addFields(
      { name: '👤 Нарушитель', value: `${target.tag || target.username || 'Пользователь'} (<@${target.id}>)`, inline: true },
      { name: '🛡️ Модератор', value: `${moderator.tag || moderator.username} (<@${moderator.id}>)`, inline: true },
      { name: '📄 Причина', value: reason || 'Нарушение правил сообщества', inline: false }
    )
    .setFooter({ text: `ID цели: ${target.id}` })
    .setTimestamp();

  return sendLog(guild, embed);
}

/**
 * Логирование изменения ролей
 */
async function logRoleChange(guild, { moderator, target, role, action, reason }) {
  const isAdd = action === 'add';
  const embed = new EmbedBuilder()
    .setColor(isAdd ? COLORS.SUCCESS : COLORS.DANGER)
    .setTitle(isAdd ? '➕ Выдача роли' : '➖ Снятие роли')
    .addFields(
      { name: '👤 Пользователь', value: `${target.tag || target.username || 'Пользователь'} (<@${target.id}>)`, inline: true },
      { name: '🛡️ Модератор', value: `${moderator.tag || moderator.username} (<@${moderator.id}>)`, inline: true },
      { name: '🎭 Роль', value: `${role.name} (<@&${role.id}>)`, inline: true },
      { name: '📄 Причина', value: reason || 'Не указана', inline: false }
    )
    .setFooter({ text: `ID цели: ${target.id}` })
    .setTimestamp();

  return sendLog(guild, embed);
}

/**
 * Логирование массовой очистки сообщений
 */
async function logClear(guild, { moderator, channel, amount, targetFilter }) {
  const embed = new EmbedBuilder()
    .setColor(COLORS.INFO)
    .setTitle('🧹 Очистка сообщений (Clear)')
    .addFields(
      { name: '💬 Канал', value: `<#${channel.id}> (${channel.name})`, inline: true },
      { name: '🛡️ Модератор', value: `${moderator.tag || moderator.username} (<@${moderator.id}>)`, inline: true },
      { name: '🔢 Удалено сообщений', value: `${amount}`, inline: true },
      { name: '🎯 Фильтр по автору', value: targetFilter ? `<@${targetFilter.id}> (${targetFilter.tag || targetFilter.username})` : 'Все авторы', inline: false }
    )
    .setTimestamp();

  return sendLog(guild, embed);
}

/**
 * Логирование системных действий (публикация правил и др.)
 */
async function logSystem(guild, { title, description, color = COLORS.INFO, fields = [] }) {
  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle(title)
    .setDescription(description)
    .setTimestamp();

  if (fields.length > 0) {
    embed.addFields(fields);
  }

  return sendLog(guild, embed);
}

// TTL-кэш для дедупликации банов между слэш-командами и audit log
const recentBans = new Set();

function markBanLogged(userId) {
  if (!userId) return;
  recentBans.add(userId);
  setTimeout(() => recentBans.delete(userId), 10000);
}

function isBanLogged(userId) {
  return recentBans.has(userId);
}

/**
 * Логирование удаления сообщения
 */
async function logMessageDelete(guild, { channel, author, content, attachments = [] }) {
  const safeContent = content ? (content.length > 1000 ? `${content.slice(0, 1000)}...` : content) : '*[Содержимое недоступно или сообщение содержало только вложения]*';

  const embed = new EmbedBuilder()
    .setColor(COLORS.DANGER)
    .setTitle('🗑️ Сообщение удалено')
    .addFields(
      { name: '💬 Канал', value: `<#${channel.id}> (${channel.name || 'неизвестно'})`, inline: true },
      { name: '👤 Автор', value: author ? `${author.tag || author.username} (<@${author.id}>)` : 'Неизвестен', inline: true },
      { name: '📄 Текст сообщения', value: `>>> ${safeContent}`, inline: false }
    )
    .setFooter({ text: author ? `ID автора: ${author.id}` : 'Аудит сообщений' })
    .setTimestamp();

  if (author && author.displayAvatarURL) {
    embed.setThumbnail(author.displayAvatarURL({ dynamic: true }));
  }

  if (attachments && attachments.length > 0) {
    const attachList = attachments.slice(0, 5).map((a, i) => `[Вложение ${i + 1}: ${a.name || 'файл'}](${a.url})`).join('\n');
    embed.addFields({ name: '📎 Вложения', value: attachList, inline: false });
  }

  return sendLog(guild, embed);
}

/**
 * Логирование редактирования сообщения
 */
async function logMessageUpdate(guild, { channel, author, oldContent, newContent, messageUrl }) {
  const safeOld = oldContent ? (oldContent.length > 900 ? `${oldContent.slice(0, 900)}...` : oldContent) : '*[Не сохранено в кэше]*';
  const safeNew = newContent ? (newContent.length > 900 ? `${newContent.slice(0, 900)}...` : newContent) : '*[Пусто]*';

  const embed = new EmbedBuilder()
    .setColor(COLORS.INFO)
    .setTitle('✏️ Сообщение отредактировано')
    .addFields(
      { name: '💬 Канал', value: `<#${channel.id}> (${channel.name || 'неизвестно'})`, inline: true },
      { name: '👤 Автор', value: author ? `${author.tag || author.username} (<@${author.id}>)` : 'Неизвестен', inline: true },
      { name: '🔗 Ссылка', value: messageUrl ? `[Перейти к сообщению](${messageUrl})` : 'Недоступна', inline: true },
      { name: '⏮️ До изменения', value: `>>> ${safeOld}`, inline: false },
      { name: '⏭️ После изменения', value: `>>> ${safeNew}`, inline: false }
    )
    .setFooter({ text: author ? `ID автора: ${author.id}` : 'Аудит сообщений' })
    .setTimestamp();

  if (author && author.displayAvatarURL) {
    embed.setThumbnail(author.displayAvatarURL({ dynamic: true }));
  }

  return sendLog(guild, embed);
}

/**
 * Логирование входа нового участника
 */
async function logMemberJoin(guild, member) {
  const user = member.user;
  const createdTimestamp = Math.floor(user.createdTimestamp / 1000);

  const embed = new EmbedBuilder()
    .setColor(COLORS.SUCCESS)
    .setTitle('📥 Новый участник присоединился')
    .setThumbnail(user.displayAvatarURL({ dynamic: true }))
    .setDescription(`<@${member.id}> (**${user.tag || user.username}**)`)
    .addFields(
      { name: '🐣 Дата регистрации', value: `<t:${createdTimestamp}:F> (<t:${createdTimestamp}:R>)`, inline: false },
      { name: '👥 Всего участников', value: `${guild.memberCount}`, inline: true }
    )
    .setFooter({ text: `ID пользователя: ${member.id}` })
    .setTimestamp();

  return sendLog(guild, embed);
}

/**
 * Логирование выхода или исключения участника
 */
async function logMemberLeave(guild, { member, kickData }) {
  const user = member.user || member;
  const embed = new EmbedBuilder().setTimestamp();

  if (user && user.displayAvatarURL) {
    embed.setThumbnail(user.displayAvatarURL({ dynamic: true }));
  }

  if (kickData) {
    embed
      .setColor(COLORS.WARNING)
      .setTitle('👢 Участник исключен (Kick)')
      .setDescription(`<@${member.id}> (**${user.tag || user.username || member.displayName || 'Пользователь'}**)`)
      .addFields(
        { name: '🛡️ Модератор', value: `<@${kickData.executor.id}> (${kickData.executor.tag || kickData.executor.username})`, inline: true },
        { name: '📄 Причина', value: kickData.reason || 'Причина не указана', inline: false },
        { name: '👥 Осталось участников', value: `${guild.memberCount}`, inline: true }
      )
      .setFooter({ text: `ID цели: ${member.id} | Зафиксировано через Audit Log` });
  } else {
    const joinedAt = member.joinedTimestamp ? `<t:${Math.floor(member.joinedTimestamp / 1000)}:R>` : 'Неизвестно';
    embed
      .setColor(COLORS.DANGER)
      .setTitle('📤 Участник покинул сервер')
      .setDescription(`<@${member.id}> (**${user.tag || user.username || member.displayName || 'Пользователь'}**)`)
      .addFields(
        { name: '⏱️ Был на сервере с', value: joinedAt, inline: true },
        { name: '👥 Осталось участников', value: `${guild.memberCount}`, inline: true }
      )
      .setFooter({ text: `ID пользователя: ${member.id}` });
  }

  return sendLog(guild, embed);
}

/**
 * Логирование голосовых действий (вход, выход, перемещение)
 */
async function logVoiceUpdate(guild, { member, action, oldChannel, newChannel }) {
  const embed = new EmbedBuilder()
    .setColor(COLORS.PRIMARY)
    .setFooter({ text: `ID пользователя: ${member.id}` })
    .setTimestamp();

  if (member.user && member.user.displayAvatarURL) {
    embed.setThumbnail(member.user.displayAvatarURL({ dynamic: true }));
  }

  if (action === 'join') {
    embed
      .setTitle('🔊 Подключение к голосовому каналу')
      .setDescription(`<@${member.id}> (**${member.user.tag || member.user.username}**) подключился к каналу <#${newChannel.id}> (\`${newChannel.name}\`)`);
  } else if (action === 'leave') {
    embed
      .setTitle('🔇 Отключение от голосового канала')
      .setDescription(`<@${member.id}> (**${member.user.tag || member.user.username}**) покинул канал <#${oldChannel.id}> (\`${oldChannel.name}\`)`);
  } else if (action === 'move') {
    embed
      .setTitle('🔄 Переход между голосовыми каналами')
      .setDescription(`<@${member.id}> (**${member.user.tag || member.user.username}**) перешел из одного канала в другой`)
      .addFields(
        { name: 'Откуда', value: `<#${oldChannel.id}> (\`${oldChannel.name}\`)`, inline: true },
        { name: 'Куда', value: `<#${newChannel.id}> (\`${newChannel.name}\`)`, inline: true }
      );
  }

  return sendLog(guild, embed);
}

/**
 * Логирование бана/разбана из событий Audit Log
 */
async function logBanAudit(guild, { target, executor, reason, action }) {
  const isBan = action === 'ban';
  const embed = new EmbedBuilder()
    .setColor(isBan ? COLORS.DANGER : COLORS.SUCCESS)
    .setTitle(isBan ? '🔨 Блокировка участника (Ban)' : '🔓 Снятие блокировки (Unban)')
    .addFields(
      { name: '👤 Пользователь', value: `${target.tag || target.username || 'Пользователь'} (<@${target.id}>)`, inline: true },
      { name: '🛡️ Модератор', value: executor ? `${executor.tag || executor.username} (<@${executor.id}>)` : 'Неизвестен', inline: true },
      { name: '📄 Причина', value: reason || 'Причина не указана', inline: false }
    )
    .setFooter({ text: `ID цели: ${target.id} | Аудит модерации` })
    .setTimestamp();

  if (target && target.displayAvatarURL) {
    embed.setThumbnail(target.displayAvatarURL({ dynamic: true }));
  }

  return sendLog(guild, embed);
}

/**
 * Логирование структуры каналов
 */
async function logChannelChange(guild, { channel, executor, action, details }) {
  let title = '📁 Изменение канала';
  let color = COLORS.INFO;

  if (action === 'create') {
    title = '📁 Канал создан';
    color = COLORS.SUCCESS;
  } else if (action === 'delete') {
    title = '🗑️ Канал удален';
    color = COLORS.DANGER;
  } else if (action === 'update') {
    title = '⚙️ Канал обновлен';
    color = COLORS.INFO;
  }

  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle(title)
    .addFields(
      { name: '💬 Канал', value: `${channel.name} (${action === 'delete' ? channel.id : `<#${channel.id}>`})`, inline: true },
      { name: '🛠️ Исполнитель', value: executor ? `${executor.tag || executor.username} (<@${executor.id}>)` : 'Система / Неизвестно', inline: true }
    )
    .setFooter({ text: `ID канала: ${channel.id}` })
    .setTimestamp();

  if (details) {
    embed.addFields({ name: '📝 Детали', value: details, inline: false });
  }

  return sendLog(guild, embed);
}

/**
 * Логирование структуры ролей
 */
async function logRoleStructureChange(guild, { role, executor, action, details }) {
  let title = '🎭 Изменение роли';
  let color = COLORS.INFO;

  if (action === 'create') {
    title = '➕ Роль создана';
    color = COLORS.SUCCESS;
  } else if (action === 'delete') {
    title = '🗑️ Роль удалена';
    color = COLORS.DANGER;
  } else if (action === 'update') {
    title = '⚙️ Роль обновлена';
    color = COLORS.INFO;
  }

  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle(title)
    .addFields(
      { name: '🎭 Роль', value: `${role.name} (${action === 'delete' ? role.id : `<@&${role.id}>`})`, inline: true },
      { name: '🛠️ Исполнитель', value: executor ? `${executor.tag || executor.username} (<@${executor.id}>)` : 'Система / Неизвестно', inline: true }
    )
    .setFooter({ text: `ID роли: ${role.id}` })
    .setTimestamp();

  if (details) {
    embed.addFields({ name: '📝 Детали', value: details, inline: false });
  }

  return sendLog(guild, embed);
}

module.exports = {
  getOrCreateLogChannel,
  sendLog,
  logBan,
  logKick,
  logMute,
  logUnmute,
  logWarn,
  logRoleChange,
  logClear,
  logSystem,
  markBanLogged,
  isBanLogged,
  logMessageDelete,
  logMessageUpdate,
  logMemberJoin,
  logMemberLeave,
  logVoiceUpdate,
  logBanAudit,
  logChannelChange,
  logRoleStructureChange
};
