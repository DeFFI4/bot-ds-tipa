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
  logSystem
};
