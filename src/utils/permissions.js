const { PermissionFlagsBits } = require('discord.js');
const { MOD_ROLE_ID } = require('../config');

/**
 * Проверка наличия прав модератора у участника сервера.
 * Права предоставляются:
 * 1. Владельцу сервера
 * 2. Пользователям с правом Administrator
 * 3. Пользователям, обладающим ролью MOD_ROLE_ID
 *
 * @param {import('discord.js').GuildMember} member
 * @returns {boolean}
 */
function hasModPermission(member) {
  if (!member || !member.guild) return false;

  // Владелец сервера
  if (member.id === member.guild.ownerId) return true;

  // Администратор сервера
  if (member.permissions.has(PermissionFlagsBits.Administrator)) return true;

  // Наличие роли модератора
  if (member.roles && member.roles.cache.has(MOD_ROLE_ID)) return true;

  return false;
}

/**
 * Проверка иерархии ролей для выполнения модераторских действий над участником.
 * Бот и модератор не могут наказывать участников равного или более высокого ранга.
 *
 * @param {import('discord.js').GuildMember} moderator
 * @param {import('discord.js').GuildMember} target
 * @returns {{ allowed: boolean, reason?: string }}
 */
function checkModerationHierarchy(moderator, target) {
  if (!target) {
    return { allowed: true };
  }

  // Нельзя наказать самого себя через бот
  if (moderator.id === target.id) {
    return { allowed: false, reason: 'Вы не можете применить это действие к самому себе.' };
  }

  // Нельзя наказать бота самим собой
  if (target.id === moderator.client.user.id) {
    return { allowed: false, reason: 'Вы не можете применить это действие к боту.' };
  }

  // Владельца сервера нельзя модерировать
  if (target.id === target.guild.ownerId) {
    return { allowed: false, reason: 'Невозможно применить действие к владельцу сервера.' };
  }

  // Проверка иерархии модератора (если модератор не овнер)
  if (moderator.id !== moderator.guild.ownerId) {
    if (moderator.roles.highest.position <= target.roles.highest.position) {
      return {
        allowed: false,
        reason: 'Вы не можете модерировать участника с равной или более высокой ролью.'
      };
    }
  }

  // Проверка иерархии самого бота
  const botMember = target.guild.members.me;
  if (botMember && botMember.roles.highest.position <= target.roles.highest.position) {
    return {
      allowed: false,
      reason: 'Роль бота находится ниже или на одном уровне с ролью этого участника.'
    };
  }

  return { allowed: true };
}

module.exports = {
  hasModPermission,
  checkModerationHierarchy
};
