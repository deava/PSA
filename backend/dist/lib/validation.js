"use strict";
/**
 * Validation Utilities
 * Provides runtime type checking and validation for forms and API data
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DepartmentValidationSchema = exports.UserValidationSchema = exports.RoleValidationSchema = void 0;
exports.validateRole = validateRole;
exports.validateUser = validateUser;
exports.validateDepartment = validateDepartment;
exports.validateUserRoleAssignment = validateUserRoleAssignment;
exports.validateRequired = validateRequired;
exports.validateString = validateString;
exports.validateEmail = validateEmail;
exports.validateUUID = validateUUID;
exports.validateArray = validateArray;
exports.validateObject = validateObject;
exports.validateFormData = validateFormData;
exports.sanitizeString = sanitizeString;
exports.sanitizeEmail = sanitizeEmail;
exports.sanitizeArray = sanitizeArray;
const permissions_1 = require("./permissions");
const debug_logger_1 = require("./debug-logger");
// Validation functions
function validateRole(data) {
    const errors = [];
    const warnings = [];
    debug_logger_1.logger.debug('Validating role data', { action: 'validation', function: 'validateRole' });
    // Required fields
    if (!data.name || typeof data.name !== 'string' || data.name.trim().length === 0) {
        errors.push('Role name is required and must be a non-empty string');
    }
    else if (data.name.length > 100) {
        errors.push('Role name must be 100 characters or less');
    }
    if (!data.department_id || typeof data.department_id !== 'string') {
        errors.push('Department ID is required');
    }
    // Optional fields validation
    if (data.description && data.description.length > 500) {
        warnings.push('Description is quite long (over 500 characters)');
    }
    if (data.reporting_role_id && data.reporting_role_id === data.department_id) {
        errors.push('Role cannot report to itself');
    }
    // Permissions validation
    if (data.permissions) {
        const validPermissions = Object.values(permissions_1.Permission);
        const invalidPermissions = Object.keys(data.permissions).filter(key => !validPermissions.includes(key));
        if (invalidPermissions.length > 0) {
            errors.push(`Invalid permissions: ${invalidPermissions.join(', ')}`);
        }
    }
    const result = {
        isValid: errors.length === 0,
        errors,
        warnings,
    };
    debug_logger_1.logger.debug('Role validation result', {
        action: 'validation',
        function: 'validateRole',
        isValid: result.isValid,
        errorCount: errors.length,
        warningCount: warnings.length
    });
    return result;
}
function validateUser(data) {
    const errors = [];
    const warnings = [];
    debug_logger_1.logger.debug('Validating user data', { action: 'validation', function: 'validateUser' });
    // Required fields
    if (!data.name || typeof data.name !== 'string' || data.name.trim().length === 0) {
        errors.push('Name is required and must be a non-empty string');
    }
    else if (data.name.length > 100) {
        errors.push('Name must be 100 characters or less');
    }
    if (!data.email || typeof data.email !== 'string') {
        errors.push('Email is required');
    }
    else {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(data.email)) {
            errors.push('Email must be a valid email address');
        }
        else if (data.email.length > 255) {
            errors.push('Email must be 255 characters or less');
        }
    }
    // Optional fields validation
    if (data.bio && data.bio.length > 1000) {
        warnings.push('Bio is quite long (over 1000 characters)');
    }
    if (data.skills && Array.isArray(data.skills)) {
        if (data.skills.length > 20) {
            warnings.push('User has many skills (over 20)');
        }
        const invalidSkills = data.skills.filter((skill) => typeof skill !== 'string' || skill.trim().length === 0);
        if (invalidSkills.length > 0) {
            errors.push('All skills must be non-empty strings');
        }
    }
    const result = {
        isValid: errors.length === 0,
        errors,
        warnings,
    };
    debug_logger_1.logger.debug('User validation result', {
        action: 'validation',
        function: 'validateUser',
        isValid: result.isValid,
        errorCount: errors.length,
        warningCount: warnings.length
    });
    return result;
}
function validateDepartment(data) {
    const errors = [];
    const warnings = [];
    debug_logger_1.logger.debug('Validating department data', { action: 'validation', function: 'validateDepartment' });
    // Required fields
    if (!data.name || typeof data.name !== 'string' || data.name.trim().length === 0) {
        errors.push('Department name is required and must be a non-empty string');
    }
    else if (data.name.length > 100) {
        errors.push('Department name must be 100 characters or less');
    }
    // Optional fields validation
    if (data.description && data.description.length > 500) {
        warnings.push('Description is quite long (over 500 characters)');
    }
    const result = {
        isValid: errors.length === 0,
        errors,
        warnings,
    };
    debug_logger_1.logger.debug('Department validation result', {
        action: 'validation',
        function: 'validateDepartment',
        isValid: result.isValid,
        errorCount: errors.length,
        warningCount: warnings.length
    });
    return result;
}
function validateUserRoleAssignment(data) {
    const errors = [];
    const warnings = [];
    debug_logger_1.logger.debug('Validating user role assignment', { action: 'validation', function: 'validateUserRoleAssignment' });
    // Required fields
    if (!data.user_id || typeof data.user_id !== 'string') {
        errors.push('User ID is required');
    }
    if (!data.role_id || typeof data.role_id !== 'string') {
        errors.push('Role ID is required');
    }
    if (!data.assigned_by || typeof data.assigned_by !== 'string') {
        errors.push('Assigned by user ID is required');
    }
    // Check for self-assignment
    if (data.user_id && data.assigned_by && data.user_id === data.assigned_by) {
        warnings.push('User is assigning themselves to a role');
    }
    const result = {
        isValid: errors.length === 0,
        errors,
        warnings,
    };
    debug_logger_1.logger.debug('User role assignment validation result', {
        action: 'validation',
        function: 'validateUserRoleAssignment',
        isValid: result.isValid,
        errorCount: errors.length,
        warningCount: warnings.length
    });
    return result;
}
// Generic validation helpers
function validateRequired(value, fieldName) {
    if (value === null || value === undefined || value === '') {
        return `${fieldName} is required`;
    }
    return null;
}
function validateString(value, fieldName, maxLength) {
    if (typeof value !== 'string') {
        return `${fieldName} must be a string`;
    }
    if (value.trim().length === 0) {
        return `${fieldName} cannot be empty`;
    }
    if (maxLength && value.length > maxLength) {
        return `${fieldName} must be ${maxLength} characters or less`;
    }
    return null;
}
function validateEmail(email) {
    if (!email || typeof email !== 'string') {
        return 'Email is required';
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        return 'Email must be a valid email address';
    }
    if (email.length > 255) {
        return 'Email must be 255 characters or less';
    }
    return null;
}
function validateUUID(uuid, fieldName) {
    if (!uuid || typeof uuid !== 'string') {
        return `${fieldName} is required`;
    }
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(uuid)) {
        return `${fieldName} must be a valid UUID`;
    }
    return null;
}
function validateArray(value, fieldName, itemValidator) {
    if (!Array.isArray(value)) {
        return `${fieldName} must be an array`;
    }
    if (itemValidator) {
        for (let i = 0; i < value.length; i++) {
            const error = itemValidator(value[i]);
            if (error) {
                return `${fieldName}[${i}]: ${error}`;
            }
        }
    }
    return null;
}
function validateObject(value, fieldName, requiredFields) {
    if (typeof value !== 'object' || value === null) {
        return `${fieldName} must be an object`;
    }
    for (const field of requiredFields) {
        if (!(field in value)) {
            return `${fieldName} is missing required field: ${field}`;
        }
    }
    return null;
}
// Form validation helpers
function validateFormData(data, validators) {
    const errors = [];
    const warnings = [];
    debug_logger_1.logger.debug('Validating form data', { action: 'validation', function: 'validateFormData' });
    for (const [field, validator] of Object.entries(validators)) {
        const error = validator(data[field]);
        if (error) {
            errors.push(error);
        }
    }
    const result = {
        isValid: errors.length === 0,
        errors,
        warnings,
    };
    debug_logger_1.logger.debug('Form validation result', {
        action: 'validation',
        function: 'validateFormData',
        isValid: result.isValid,
        errorCount: errors.length,
        fieldCount: Object.keys(validators).length
    });
    return result;
}
// Sanitization helpers
function sanitizeString(value) {
    return value.trim().replace(/\s+/g, ' ');
}
function sanitizeEmail(email) {
    return email.trim().toLowerCase();
}
function sanitizeArray(array) {
    return array
        .map((item) => sanitizeString(item))
        .filter((item) => item.length > 0);
}
// Export validation schemas for common use cases
exports.RoleValidationSchema = {
    name: (value) => validateString(value, 'Role name', 100),
    description: (value) => value ? validateString(value, 'Description', 500) : null,
    department_id: (value) => validateUUID(value, 'Department ID'),
    reporting_role_id: (value) => value ? validateUUID(value, 'Reporting role ID') : null,
};
exports.UserValidationSchema = {
    name: (value) => validateString(value, 'Name', 100),
    email: (value) => validateEmail(value),
    bio: (value) => value ? validateString(value, 'Bio', 1000) : null,
    skills: (value) => value ? validateArray(value, 'Skills', (item) => validateString(item, 'Skill', 50)) : null,
};
exports.DepartmentValidationSchema = {
    name: (value) => validateString(value, 'Department name', 100),
    description: (value) => value ? validateString(value, 'Description', 500) : null,
};
