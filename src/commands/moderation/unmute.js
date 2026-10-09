const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { hasModPermission, checkModerationHierarchy } = require('../../utils/permissions');
const { logUnmute } = require('../../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('unmute')
    .setDescription('Досрочно снять тайм-аут (размутить) участника')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption((option) =>
      option
        .setName('target')
        .setDescription('Пользователь для снятия тайм-аута')
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName('reason')
        .setDescription('Причина досрочного снятия')
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
    const reason = interaction.options.getString('reason') || 'Досрочное снятие тайм-аута';

    let targetMember = null;
    try {
      targetMember = await interaction.guild.members.fetch(targetUser.id);
    } catch {
      return interaction.reply({
        content: '❌ Пользователь не найден на этом сервере.',
        ephemeral: true
      });
    }

    if (!targetMember.isCommunicationDisabled()) {
      return interaction.reply({
        content: 'ℹ️ У этого участника в данный момент нет активного тайм-аута.',
        ephemeral: true
      });
    }

    const hierarchy = checkModerationHierarchy(interaction.member, targetMember);
    if (!hierarchy.allowed) {
      return interaction.reply({
        content: `❌ Невозможно снять тайм-аут: ${hierarchy.reason}`,
        ephemeral: true
      });
    }

    try {
      await targetMember.timeout(null, `${reason} | Модератор: ${interaction.user.tag}`);

      // Уведомление в ЛС
      try {
        await targetMember.send({
          content: `🔊 С вас досрочно снят тайм-аут на сервере **${interaction.guild.name}**.\n**Причина:** ${reason}\n**Модератор:** ${interaction.user.tag}`
        });
      } catch {
        // ЛС закрыты
      }

      await logUnmute(interaction.guild, {
        moderator: interaction.user,
        target: targetUser,
        reason
      });

      return interaction.reply({
        content: `✅ Тайм-аут с пользователя **${targetUser.tag}** успешно снят.\n**Причина:** ${reason}`,
        ephemeral: false
      });
    } catch (err) {
      console.error('[Command: unmute] Ошибка при снятии тайм-аута:', err);
      return interaction.reply({
        content: `❌ Не удалось снять тайм-аут: ${err.message}`,
        ephemeral: true
      });
    }
  }
};
