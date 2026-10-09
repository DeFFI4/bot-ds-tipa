const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { hasModPermission } = require('../../utils/permissions');
const { logRoleChange } = require('../../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('role')
    .setDescription('Управление ролями участников')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
    .addSubcommand((subcommand) =>
      subcommand
        .setName('add')
        .setDescription('Выдать роль участнику')
        .addUserOption((opt) =>
          opt
            .setName('target')
            .setDescription('Пользователь')
            .setRequired(true)
        )
        .addRoleOption((opt) =>
          opt
            .setName('role')
            .setDescription('Роль для выдачи')
            .setRequired(true)
        )
        .addStringOption((opt) =>
          opt
            .setName('reason')
            .setDescription('Причина действия')
            .setRequired(false)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('remove')
        .setDescription('Снять роль с участника')
        .addUserOption((opt) =>
          opt
            .setName('target')
            .setDescription('Пользователь')
            .setRequired(true)
        )
        .addRoleOption((opt) =>
          opt
            .setName('role')
            .setDescription('Роль для снятия')
            .setRequired(true)
        )
        .addStringOption((opt) =>
          opt
            .setName('reason')
            .setDescription('Причина действия')
            .setRequired(false)
        )
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

    const subcommand = interaction.options.getSubcommand();
    const targetUser = interaction.options.getUser('target');
    const role = interaction.options.getRole('role');
    const reason = interaction.options.getString('reason') || 'Действие выполнено модератором';

    let targetMember = null;
    try {
      targetMember = await interaction.guild.members.fetch(targetUser.id);
    } catch {
      return interaction.reply({
        content: '❌ Пользователь не найден на сервере.',
        ephemeral: true
      });
    }

    // Проверка, не системная ли роль (боты, бусты)
    if (role.managed) {
      return interaction.reply({
        content: '❌ Эта роль управляется внешней интеграцией и не может быть назначена вручную.',
        ephemeral: true
      });
    }

    // Проверка позиции роли бота
    const botMember = interaction.guild.members.me;
    if (botMember && role.position >= botMember.roles.highest.position) {
      return interaction.reply({
        content: '❌ Бот не может управлять этой ролью: она находится выше или на одном уровне с высшей ролью бота.',
        ephemeral: true
      });
    }

    // Проверка позиции роли модератора (если модератор не овнер)
    if (interaction.member.id !== interaction.guild.ownerId) {
      if (role.position >= interaction.member.roles.highest.position) {
        return interaction.reply({
          content: '❌ Вы не можете управлять ролью, равной или превышающей вашу наивысшую роль.',
          ephemeral: true
        });
      }
    }

    try {
      if (subcommand === 'add') {
        if (targetMember.roles.cache.has(role.id)) {
          return interaction.reply({
            content: `ℹ️ У пользователя **${targetUser.tag}** уже есть роль <@&${role.id}>.`,
            ephemeral: true
          });
        }

        await targetMember.roles.add(role.id, `${reason} | Модератор: ${interaction.user.tag}`);

        await logRoleChange(interaction.guild, {
          moderator: interaction.user,
          target: targetUser,
          role,
          action: 'add',
          reason
        });

        return interaction.reply({
          content: `✅ Роль <@&${role.id}> успешно выдана пользователю **${targetUser.tag}**.\n**Причина:** ${reason}`,
          ephemeral: false
        });
      } else if (subcommand === 'remove') {
        if (!targetMember.roles.cache.has(role.id)) {
          return interaction.reply({
            content: `ℹ️ У пользователя **${targetUser.tag}** отсутствует роль <@&${role.id}>.`,
            ephemeral: true
          });
        }

        await targetMember.roles.remove(role.id, `${reason} | Модератор: ${interaction.user.tag}`);

        await logRoleChange(interaction.guild, {
          moderator: interaction.user,
          target: targetUser,
          role,
          action: 'remove',
          reason
        });

        return interaction.reply({
          content: `✅ Роль <@&${role.id}> успешно снята с пользователя **${targetUser.tag}**.\n**Причина:** ${reason}`,
          ephemeral: false
        });
      }
    } catch (err) {
      console.error(`[Command: role ${subcommand}] Ошибка:`, err);
      return interaction.reply({
        content: `❌ Ошибка при изменении роли: ${err.message}`,
        ephemeral: true
      });
    }
  }
};
