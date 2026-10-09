const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { hasModPermission } = require('../../utils/permissions');
const { logClear } = require('../../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('clear')
    .setDescription('Массовая очистка сообщений в канале')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addIntegerOption((option) =>
      option
        .setName('amount')
        .setDescription('Количество сообщений для удаления (1-100)')
        .setMinValue(1)
        .setMaxValue(100)
        .setRequired(true)
    )
    .addUserOption((option) =>
      option
        .setName('target')
        .setDescription('Фильтр: удалять сообщения только от этого пользователя')
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

    const amount = interaction.options.getInteger('amount');
    const targetUser = interaction.options.getUser('target');

    await interaction.deferReply({ ephemeral: true });

    try {
      const channel = interaction.channel;
      const messages = await channel.messages.fetch({ limit: targetUser ? 100 : amount });

      let toDelete = messages;
      if (targetUser) {
        toDelete = messages.filter((m) => m.author.id === targetUser.id);
        const limited = Array.from(toDelete.values()).slice(0, amount);
        toDelete = limited;
      }

      const deleted = await channel.bulkDelete(toDelete, true);

      // Логируем операцию
      await logClear(interaction.guild, {
        moderator: interaction.user,
        channel,
        amount: deleted.size,
        targetFilter: targetUser
      });

      return interaction.editReply({
        content: `🧹 Успешно удалено **${deleted.size}** сообщений${targetUser ? ` от пользователя **${targetUser.tag}**` : ''}. (Сообщения старше 14 дней не подлежат массовому удалению Discord).`
      });
    } catch (err) {
      console.error('[Command: clear] Ошибка при очистке сообщений:', err);
      return interaction.editReply({
        content: `❌ Произошла ошибка при удалении сообщений: ${err.message}`
      });
    }
  }
};
