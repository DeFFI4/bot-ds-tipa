const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { hasModPermission, checkModerationHierarchy } = require('../../utils/permissions');
const { logBan } = require('../../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Заблокировать участника на сервере')
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .addUserOption((option) =>
      option
        .setName('target')
        .setDescription('Пользователь для блокировки')
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName('reason')
        .setDescription('Причина блокировки')
        .setRequired(false)
    )
    .addIntegerOption((option) =>
      option
        .setName('delete_days')
        .setDescription('Количество дней для удаления сообщений (0-7)')
        .setMinValue(0)
        .setMaxValue(7)
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
    const reason = interaction.options.getString('reason') || 'Причина не указана';
    const deleteDays = interaction.options.getInteger('delete_days') || 0;

    let targetMember = null;
    try {
      targetMember = await interaction.guild.members.fetch(targetUser.id);
    } catch {
      targetMember = null;
    }

    if (targetMember) {
      const hierarchy = checkModerationHierarchy(interaction.member, targetMember);
      if (!hierarchy.allowed) {
        return interaction.reply({
          content: `❌ Невозможно выполнить действие: ${hierarchy.reason}`,
          ephemeral: true
        });
      }

      // Попытка отправить уведомление в ЛС перед баном
      try {
        await targetMember.send({
          content: `⚠️ Вы были заблокированы на сервере **${interaction.guild.name}**.\n**Причина:** ${reason}\n**Модератор:** ${interaction.user.tag}`
        });
      } catch {
        // ЛС пользователя закрыты или бот заблокирован
      }
    }

    try {
      await interaction.guild.members.ban(targetUser.id, {
        deleteMessageSeconds: deleteDays * 24 * 60 * 60,
        reason: `${reason} | Модератор: ${interaction.user.tag}`
      });

      // Логирование в lounge-logs
      await logBan(interaction.guild, {
        moderator: interaction.user,
        target: targetUser,
        reason,
        deleteDays
      });

      return interaction.reply({
        content: `✅ Пользователь **${targetUser.tag}** (${targetUser.id}) успешно заблокирован.\n**Причина:** ${reason}`,
        ephemeral: false
      });
    } catch (err) {
      console.error('[Command: ban] Ошибка при бане:', err);
      return interaction.reply({
        content: `❌ Произошла ошибка при блокировке пользователя: ${err.message}`,
        ephemeral: true
      });
    }
  }
};
