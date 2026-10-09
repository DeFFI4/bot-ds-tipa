const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { hasModPermission } = require('../../utils/permissions');
const { RULES_CHANNEL_ID, COLORS } = require('../../config');
const { createRulesEmbeds } = require('../../utils/rulesData');
const { logSystem } = require('../../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('rules')
    .setDescription('Управление официальными правилами сервера')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand((subcommand) =>
      subcommand
        .setName('post')
        .setDescription('Опубликовать полный регламент правил в официальный канал')
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

    await interaction.deferReply({ ephemeral: true });

    try {
      const channel = await interaction.guild.channels.fetch(RULES_CHANNEL_ID).catch(() => null);

      if (!channel) {
        return interaction.editReply({
          content: `❌ Канал с ID \`${RULES_CHANNEL_ID}\` не найден на этом сервере. Проверьте ID канала в \`config.js\`.`
        });
      }

      if (!channel.isTextBased()) {
        return interaction.editReply({
          content: `❌ Целевой канал <#${channel.id}> не является текстовым каналом.`
        });
      }

      const embeds = createRulesEmbeds();

      // Отправляем все 4 раздела правил в целевой канал
      // Discord позволяет отправлять до 10 Embed в одном сообщении
      await channel.send({ embeds });

      // Записываем событие в аудит lounge-logs
      await logSystem(interaction.guild, {
        title: '📜 Официальные правила опубликованы',
        description: `Модератор <@${interaction.user.id}> (${interaction.user.tag}) опубликовал актуальную редакцию правил в канале <#${channel.id}>.`,
        color: COLORS.INFO,
        fields: [
          { name: '📍 Канал', value: `<#${channel.id}>`, inline: true },
          { name: '📑 Количество разделов', value: `${embeds.length}`, inline: true }
        ]
      });

      return interaction.editReply({
        content: `✅ Свод правил (4 раздела) успешно опубликован в канале <#${channel.id}>!`
      });
    } catch (err) {
      console.error('[Command: rules] Ошибка публикации правил:', err);
      return interaction.editReply({
        content: `❌ Ошибка при публикации правил: ${err.message}`
      });
    }
  }
};
