const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { hasModPermission, checkModerationHierarchy } = require('../../utils/permissions');
const { logMute } = require('../../utils/logger');

/**
 * Парсер строки времени в миллисекунды
 * Поддерживает: 10s, 5m, 2h, 1d, 7d
 * @param {string} str
 * @returns {number|null}
 */
function parseDuration(str) {
  if (!str) return null;
  const match = str.trim().match(/^(\d+)\s*(s|sec|m|min|h|hour|d|day)?$/i);
  if (!match) return null;

  const value = parseInt(match[1], 10);
  const unit = (match[2] || 'm').toLowerCase();

  switch (unit) {
    case 's':
    case 'sec':
      return value * 1000;
    case 'm':
    case 'min':
      return value * 60 * 1000;
    case 'h':
    case 'hour':
      return value * 60 * 60 * 1000;
    case 'd':
    case 'day':
      return value * 24 * 60 * 60 * 1000;
    default:
      return value * 60 * 1000;
  }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('mute')
    .setDescription('Выдать тайм-аут (мут) участнику')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption((option) =>
      option
        .setName('target')
        .setDescription('Пользователь для выдачи тайм-аута')
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName('duration')
        .setDescription('Длительность (например: 10m, 2h, 1d, максимум 28d)')
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName('reason')
        .setDescription('Причина тайм-аута')
        .setRequired(false)
    ),

  /**
   * @param {import('discord.js').ChatInputCommandInteraction} interaction
   */
  async execute(interaction) {
    if (!hasModPermission(interaction.member)) {
      return interaction.reply({
        content: '❌ У вас нет прав для выполнения этой команды. Требуется роль модератора или права Администратора.',
        ephemeral: true
      });
    }

    const targetUser = interaction.options.getUser('target');
    const durationInput = interaction.options.getString('duration');
    const reason = interaction.options.getString('reason') || 'Причина не указана';

    const ms = parseDuration(durationInput);
    const maxMs = 28 * 24 * 60 * 60 * 1000; // Лимит Discord: 28 дней

    if (!ms || ms < 5000 || ms > maxMs) {
      return interaction.reply({
        content: '❌ Неверный формат длительности. Укажите от 5 секунд до 28 дней (примеры: `10m`, `2h`, `1d`).',
        ephemeral: true
      });
    }

    let targetMember = null;
    try {
      targetMember = await interaction.guild.members.fetch(targetUser.id);
    } catch {
      return interaction.reply({
        content: '❌ Пользователь не найден на этом сервере.',
        ephemeral: true
      });
    }

    const hierarchy = checkModerationHierarchy(interaction.member, targetMember);
    if (!hierarchy.allowed) {
      return interaction.reply({
        content: `❌ Невозможно применить тайм-аут: ${hierarchy.reason}`,
        ephemeral: true
      });
    }

    try {
      await targetMember.timeout(ms, `${reason} | Модератор: ${interaction.user.tag}`);

      // Уведомление в ЛС
      try {
        await targetMember.send({
          content: `🔇 Вам выдан тайм-аут на сервере **${interaction.guild.name}** на **${durationInput}**.\n**Причина:** ${reason}\n**Модератор:** ${interaction.user.tag}`
        });
      } catch {
        // ЛС закрыты
      }

      await logMute(interaction.guild, {
        moderator: interaction.user,
        target: targetUser,
        duration: durationInput,
        reason
      });

      return interaction.reply({
        content: `✅ Пользователю **${targetUser.tag}** выдан тайм-аут на **${durationInput}**.\n**Причина:** ${reason}`,
        ephemeral: false
      });
    } catch (err) {
      console.error('[Command: mute] Ошибка при выдаче тайм-аута:', err);
      return interaction.reply({
        content: `❌ Не удалось выдать тайм-аут: ${err.message}`,
        ephemeral: true
      });
    }
  }
};
