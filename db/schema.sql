-- ============================================================================
-- FILL_DB.SQL
-- 1. Creates Database Schema
-- 2. Defines Stored Procedures (CRUD)
-- 3. Populates initial data (Entities, Relations, Instances)
-- ============================================================================

-- ============================================================================
-- PART 1: Schema Creation (from create_db_resourcemanagement_mariadb.sql)
-- ============================================================================

-- Database:  DB-Ressourcenmanagement
-- MariaDB Schema Creation Script

CREATE DATABASE IF NOT EXISTS db_resourcemanagement;
USE db_resourcemanagement;

-- Drop tables if they exist (disable FK checks to avoid errors)
SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS t_relation_values;
DROP TABLE IF EXISTS t_relation_participant;
DROP TABLE IF EXISTS t_relation;
DROP TABLE IF EXISTS t_values;
DROP TABLE IF EXISTS t_attribute;
DROP TABLE IF EXISTS t_datatype;
DROP TABLE IF EXISTS t_entity;
DROP TABLE IF EXISTS t_user_preferences;
DROP TABLE IF EXISTS t_preferences;
DROP TABLE IF EXISTS t_users;
SET FOREIGN_KEY_CHECKS = 1;

-- ============================================================================
-- Table: t_entity
-- Description: Stores entity types
-- ============================================================================
CREATE TABLE t_entity (
    entity_id INT AUTO_INCREMENT PRIMARY KEY COMMENT 'Unique identifier for entity',
    entity_type VARCHAR(255) NOT NULL COMMENT 'Type/name of the entity',
    isEvent BOOLEAN NOT NULL DEFAULT FALSE COMMENT 'If true, this entity represents an event type'
) COMMENT='Stores entity types for the resource management system';

-- ============================================================================
-- Table: t_datatype
-- Description: Stores available data types
-- ============================================================================
CREATE TABLE t_datatype (
    datatype_id INT AUTO_INCREMENT PRIMARY KEY COMMENT 'Unique identifier for datatype',
    datatype VARCHAR(100) NOT NULL UNIQUE COMMENT 'Name of the data type'
) COMMENT='Stores available data types for attributes';

-- ============================================================================
-- Table: t_attribute
-- Description: Stores attributes for entities
-- ============================================================================
CREATE TABLE t_attribute (
    attribute_id INT AUTO_INCREMENT PRIMARY KEY COMMENT 'Unique identifier for attribute',
    fk_entity_id INTEGER COMMENT 'Foreign key referencing entity',
    fk_datatype_id INTEGER NOT NULL COMMENT 'Foreign key referencing datatype',
    attribute_name VARCHAR(255) NOT NULL COMMENT 'Name of the attribute',
    is_unique BOOLEAN NOT NULL DEFAULT FALSE COMMENT 'Indicates if this attribute is a unique identifier (PK)',
    access ENUM('read_public', 'write_public', 'teachers_only', 'owner_only') NOT NULL DEFAULT 'write_public' COMMENT 'Access level for this attribute',
    isPrivate BOOLEAN NOT NULL DEFAULT FALSE COMMENT 'If true, attribute is hidden from public views',
    expirationDate DATE DEFAULT NULL COMMENT 'When elapsed, access automatically shifts to read',
    isRequired BOOLEAN NOT NULL DEFAULT FALSE COMMENT 'If true, this attribute must be provided on instance creation',
    isInputField BOOLEAN NOT NULL DEFAULT FALSE COMMENT 'If true, this is a relation input field (read/write + expirationDate)',
    isListRessource BOOLEAN NOT NULL DEFAULT FALSE COMMENT 'If true, this attribute is a list resource (entity attribute)',
    isSingularRessource BOOLEAN NOT NULL DEFAULT FALSE COMMENT 'If true, this relation attribute accepts only a single value',
    isPersonRessource BOOLEAN NOT NULL DEFAULT FALSE COMMENT 'If true, this is a person resource (entity attribute where entity = Student or Teacher)',
    
    CONSTRAINT fk_attribute_entity 
        FOREIGN KEY (fk_entity_id) 
        REFERENCES t_entity(entity_id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,
    
    CONSTRAINT fk_attribute_datatype 
        FOREIGN KEY (fk_datatype_id) 
        REFERENCES t_datatype(datatype_id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE
) COMMENT='Stores attributes associated with entities';

-- Index for performance
CREATE INDEX idx_attribute_entity ON t_attribute(fk_entity_id);
CREATE INDEX idx_attribute_datatype ON t_attribute(fk_datatype_id);

-- ============================================================================
-- Table: t_values
-- Description: Stores actual values for attributes
-- ============================================================================
CREATE TABLE t_values (
    value_id INT AUTO_INCREMENT PRIMARY KEY COMMENT 'Unique identifier for value',
    fk_attribute_id INTEGER NOT NULL COMMENT 'Foreign key referencing attribute',
    value VARCHAR(1000) COMMENT 'Actual value stored as text',
    entity_instance_id INTEGER COMMENT 'Instance identifier for grouping values belonging to same entity instance',
    
    CONSTRAINT fk_values_attribute 
        FOREIGN KEY (fk_attribute_id) 
        REFERENCES t_attribute(attribute_id)
        ON DELETE CASCADE
        ON UPDATE CASCADE
) COMMENT='Stores actual values for entity attributes';

-- Indexes for performance
CREATE INDEX idx_values_attribute ON t_values(fk_attribute_id);
CREATE INDEX idx_values_instance ON t_values(entity_instance_id);

-- ============================================================================
-- Table: t_relation
-- Description: Stores relation definitions
-- ============================================================================
CREATE TABLE t_relation (
    relation_id INT AUTO_INCREMENT PRIMARY KEY COMMENT 'Unique identifier for relation',
    name VARCHAR(255) NOT NULL COMMENT 'Name of the relation',
    type VARCHAR(50) COMMENT 'Type of the relation (e.g., 1:n, m:n)',
    description VARCHAR(500) COMMENT 'Description of the relation'
) COMMENT='Stores relation definitions between entities';

-- ============================================================================
-- Table: t_relation_participant
-- Description: Stores participants in relations with cardinality
-- ============================================================================
CREATE TABLE t_relation_participant (
    participant_id INT AUTO_INCREMENT PRIMARY KEY COMMENT 'Unique identifier for participant',
    fk_relation_id INTEGER NOT NULL COMMENT 'Foreign key referencing relation',
    card_min INTEGER NOT NULL DEFAULT 0 COMMENT 'Minimum cardinality',
    card_max INTEGER COMMENT 'Maximum cardinality (NULL = unlimited)',
    fk_att_id INTEGER NOT NULL COMMENT 'Foreign key referencing attribute',
    fk_att_id_rel INTEGER NOT NULL COMMENT 'Foreign key referencing relation attribute (FK to custom attribute for relation)',
    
    CONSTRAINT fk_participant_relation 
        FOREIGN KEY (fk_relation_id) 
        REFERENCES t_relation(relation_id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,
    
    CONSTRAINT fk_participant_attribute 
        FOREIGN KEY (fk_att_id) 
        REFERENCES t_attribute(attribute_id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,
    
    CONSTRAINT fk_participant_attribute_rel 
        FOREIGN KEY (fk_att_id_rel) 
        REFERENCES t_attribute(attribute_id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,
    
    CONSTRAINT chk_cardinality 
        CHECK (card_min >= 0 AND (card_max IS NULL OR card_max >= card_min))
) COMMENT='Stores participants in relations with cardinality constraints';

-- Indexes for performance
CREATE INDEX idx_participant_relation ON t_relation_participant(fk_relation_id);
CREATE INDEX idx_participant_att ON t_relation_participant(fk_att_id);
CREATE INDEX idx_participant_att_rel ON t_relation_participant(fk_att_id_rel);

-- ============================================================================
-- Table: t_relation_values
-- Description: Stores actual relation instances
-- ============================================================================
CREATE TABLE t_relation_values (
    relation_value_id INT AUTO_INCREMENT PRIMARY KEY COMMENT 'Unique identifier for relation value',
    fk_relation_id INTEGER NOT NULL COMMENT 'Foreign key referencing relation',
    fk_attribute_id INTEGER NOT NULL COMMENT 'Foreign key referencing attribute',
    fk_value_id INTEGER NOT NULL COMMENT 'Foreign key referencing value',
    relation_instance_id INTEGER NOT NULL COMMENT 'Instance identifier for grouping values belonging to same relation instance',
    
    CONSTRAINT fk_relation_values_relation
        FOREIGN KEY (fk_relation_id)
        REFERENCES t_relation(relation_id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,
    
    CONSTRAINT fk_relation_values_attribute 
        FOREIGN KEY (fk_attribute_id) 
        REFERENCES t_attribute(attribute_id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,
    
    CONSTRAINT fk_relation_values_value 
        FOREIGN KEY (fk_value_id) 
        REFERENCES t_values(value_id)
        ON DELETE CASCADE
        ON UPDATE CASCADE
) COMMENT='Stores actual relation instances between entity instances';

-- Indexes for performance
CREATE INDEX idx_relation_values_relation ON t_relation_values(fk_relation_id);
CREATE INDEX idx_relation_values_attribute ON t_relation_values(fk_attribute_id);
CREATE INDEX idx_relation_values_value ON t_relation_values(fk_value_id);
CREATE INDEX idx_relation_values_instance ON t_relation_values(relation_instance_id);

-- ============================================================================
-- Table: t_users
-- Description: Stores user information from Microsoft Graph API
-- ============================================================================
CREATE TABLE t_users (
    user_id INT AUTO_INCREMENT PRIMARY KEY COMMENT 'Internal unique identifier for user',
    display_name VARCHAR(255) COMMENT 'Full display name from MS Graph',
    email VARCHAR(255) COMMENT 'Primary email / UPN from MS Graph',
    job_title VARCHAR(255) COMMENT 'Job title from MS Graph'
) COMMENT='Stores user accounts sourced from Microsoft Graph API';

CREATE INDEX idx_users_email ON t_users(email);

-- ============================================================================
-- Table: t_preferences
-- Description: Stores UI preferences
-- ============================================================================
CREATE TABLE t_preferences (
    preference_id INT AUTO_INCREMENT PRIMARY KEY COMMENT 'Unique identifier for preference set',
    theme VARCHAR(50) NOT NULL DEFAULT 'light' COMMENT 'UI theme (e.g. light, dark)'
) COMMENT='Stores UI preference sets that can be assigned to users';

-- ============================================================================
-- Table: t_user_preferences
-- Description: Links users to their preference set (1:1)
-- ============================================================================
CREATE TABLE t_user_preferences (
    user_id INT NOT NULL COMMENT 'Foreign key referencing user',
    preference_id INT NOT NULL COMMENT 'Foreign key referencing preference set',
    
    PRIMARY KEY (user_id),
    
    CONSTRAINT fk_userprefs_user
        FOREIGN KEY (user_id)
        REFERENCES t_users(user_id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,
    
    CONSTRAINT fk_userprefs_preference
        FOREIGN KEY (preference_id)
        REFERENCES t_preferences(preference_id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE
) COMMENT='Links each user to their UI preference set (1:1)';

CREATE INDEX idx_userprefs_preference ON t_user_preferences(preference_id);

-- ============================================================================
-- Insert some common data types
-- ============================================================================
INSERT INTO t_datatype (datatype) VALUES 
    ('INTEGER'),
    ('VARCHAR'),
    ('TEXT'),
    ('DATE'),
    ('TIMESTAMP'),
    ('BOOLEAN'),
    ('NUMERIC'),
    ('FLOAT');


-- ============================================================================
-- PART 2: Stored Procedures (Create, Read, Update, Delete)
-- ============================================================================

-- --- FROM crud_create.sql ---
DROP SEQUENCE IF EXISTS seq_entity_instance_id;
DROP SEQUENCE IF EXISTS seq_relation_instance_id;
CREATE SEQUENCE IF NOT EXISTS seq_entity_instance_id;
CREATE SEQUENCE IF NOT EXISTS seq_relation_instance_id;

DELIMITER //

-- HELPER FUNCTIONS
-- Returns the number of elements in a comma-separated list
CREATE OR REPLACE FUNCTION get_list_length(p_list TEXT) RETURNS INT
DETERMINISTIC
BEGIN
    IF p_list IS NULL OR TRIM(p_list) = '' THEN RETURN 0; END IF;
    RETURN LENGTH(p_list) - LENGTH(REPLACE(p_list, ',', '')) + 1;
END //

-- Extracts the nth element from a comma-separated list (1-based index)
CREATE OR REPLACE FUNCTION get_list_element(p_list TEXT, p_index INT) RETURNS TEXT
DETERMINISTIC
BEGIN
    RETURN TRIM(SUBSTRING_INDEX(SUBSTRING_INDEX(p_list, ',', p_index), ',', -1));
END //

CREATE OR REPLACE FUNCTION get_pk_value_id(p_instance_id INT) RETURNS INT
DETERMINISTIC
BEGIN
    DECLARE v_value_id INT;
    
    SELECT v.value_id INTO v_value_id
    FROM t_values v
    JOIN t_attribute a ON v.fk_attribute_id = a.attribute_id
    JOIN t_entity e ON a.fk_entity_id = e.entity_id
    WHERE v.entity_instance_id = p_instance_id
    AND a.attribute_name = CONCAT(e.entity_type, '_id')
    LIMIT 1;
    
    RETURN v_value_id;
END //

-- CREATE PROCEDURES
CREATE OR REPLACE PROCEDURE create_entity_with_attributes(
    IN p_entity_type      TEXT,
    IN p_attribute_names  TEXT,
    IN p_datatypes        TEXT,
    IN p_is_event         BOOLEAN,
    IN p_is_required_flags TEXT
)
BEGIN
    DECLARE v_entity_id INT;
    DECLARE v_datatype_id INT;
    DECLARE v_pk_datatype_id INT;
    DECLARE i INT DEFAULT 1;
    DECLARE v_attr_name TEXT;
    DECLARE v_dtype_name TEXT;
    DECLARE v_attr_len INT;
    DECLARE v_dtype_len INT;
    DECLARE v_is_req BOOLEAN;

    -- Validate inputs
    IF COALESCE(TRIM(p_entity_type), '') = '' THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Entity type must not be empty';
    END IF;

    SET v_attr_len = get_list_length(p_attribute_names);
    SET v_dtype_len = get_list_length(p_datatypes);

    IF v_attr_len = 0 OR v_attr_len != v_dtype_len THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Attribute names and datatypes must be non-empty lists of equal length';
    END IF;

    -- Check and create Entity
    IF EXISTS (SELECT 1 FROM t_entity WHERE entity_type = p_entity_type) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Entity type already exists';
    END IF;

    INSERT INTO t_entity(entity_type, isEvent) VALUES (p_entity_type, p_is_event);
    SET v_entity_id = LAST_INSERT_ID();

    -- Create PK attribute (isListRessource=TRUE since it belongs to an entity)
    SELECT datatype_id INTO v_pk_datatype_id FROM t_datatype WHERE datatype = 'INTEGER';
    INSERT INTO t_attribute(fk_entity_id, fk_datatype_id, attribute_name, is_unique, isListRessource, isPersonRessource)
    VALUES (v_entity_id, v_pk_datatype_id, CONCAT(p_entity_type, '_id'), TRUE, TRUE,
            LOWER(p_entity_type) IN ('student', 'teacher'));

    -- Create other attributes (all entity attributes are automatically isListRessource=TRUE)
    WHILE i <= v_attr_len DO
        SET v_attr_name = get_list_element(p_attribute_names, i);
        SET v_dtype_name = get_list_element(p_datatypes, i);

        -- Parse optional isRequired flag (default FALSE if list is shorter or empty)
        SET v_is_req = IFNULL(CAST(get_list_element(p_is_required_flags, i) AS UNSIGNED), 0);

        SELECT datatype_id INTO v_datatype_id FROM t_datatype WHERE datatype = v_dtype_name;

        IF v_datatype_id IS NULL THEN
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Datatype not found';
        END IF;

        INSERT INTO t_attribute(fk_entity_id, fk_datatype_id, attribute_name, isRequired, isListRessource, isPersonRessource)
        VALUES (v_entity_id, v_datatype_id, v_attr_name, v_is_req, TRUE,
                LOWER(p_entity_type) IN ('student', 'teacher'));

        SET i = i + 1;
    END WHILE;
END //

CREATE OR REPLACE PROCEDURE create_attribute(
    IN p_entity_type      TEXT,
    IN p_attribute_name   VARCHAR(255),
    IN p_datatype         VARCHAR(100),
    IN p_isRequired       BOOLEAN
)
BEGIN
    DECLARE v_entity_id INT;
    DECLARE v_datatype_id INT;
    DECLARE v_attr_id INT;
    DECLARE v_inst_id INT;
    DECLARE done INT DEFAULT FALSE;

    DECLARE cur_instances CURSOR FOR
        SELECT DISTINCT entity_instance_id
        FROM t_values v
        JOIN t_attribute a ON v.fk_attribute_id = a.attribute_id
        WHERE a.fk_entity_id = v_entity_id;
    DECLARE CONTINUE HANDLER FOR NOT FOUND SET done = TRUE;

    -- Validate entity
    SELECT entity_id INTO v_entity_id FROM t_entity WHERE entity_type = p_entity_type;
    IF v_entity_id IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Entity type not found';
    END IF;

    -- Validate datatype
    SELECT datatype_id INTO v_datatype_id FROM t_datatype WHERE datatype = p_datatype;
    IF v_datatype_id IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Datatype not found';
    END IF;

    -- Check for duplicate attribute name
    IF EXISTS (
        SELECT 1 FROM t_attribute
        WHERE fk_entity_id = v_entity_id AND LOWER(attribute_name) = LOWER(p_attribute_name)
    ) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Attribute already exists for this entity';
    END IF;

    -- Create attribute (entity attributes are always isListRessource=TRUE)
    INSERT INTO t_attribute(fk_entity_id, fk_datatype_id, attribute_name, isRequired, isListRessource, isPersonRessource)
    VALUES (v_entity_id, v_datatype_id, p_attribute_name, IFNULL(p_isRequired, FALSE), TRUE,
            (SELECT LOWER(entity_type) IN ('student', 'teacher') FROM t_entity WHERE entity_id = v_entity_id));
    SET v_attr_id = LAST_INSERT_ID();

    -- Backfill existing instances with NULL value
    OPEN cur_instances;
    backfill_loop: LOOP
        FETCH cur_instances INTO v_inst_id;
        IF done THEN LEAVE backfill_loop; END IF;

        INSERT INTO t_values(fk_attribute_id, value, entity_instance_id)
        VALUES (v_attr_id, NULL, v_inst_id);
    END LOOP;
    CLOSE cur_instances;
END //

CREATE OR REPLACE PROCEDURE create_entity_instance(
    IN p_entity_type      TEXT,
    IN p_attribute_names  TEXT,
    IN p_values           TEXT
)
BEGIN
    DECLARE v_entity_id INT;
    DECLARE v_attr_len INT;
    DECLARE v_val_len INT;
    DECLARE v_attr_count INT;
    DECLARE v_attr_id INT;
    DECLARE v_attr_name_db VARCHAR(255);
    DECLARE v_attr_is_unique BOOLEAN;
    DECLARE v_idx INT;
    DECLARE v_found_idx INT;
    DECLARE v_val TEXT;
    DECLARE v_instance_id INT;
    DECLARE done INT DEFAULT FALSE;
    
    DECLARE cur_attrs CURSOR FOR 
        SELECT attribute_id, attribute_name, is_unique FROM t_attribute WHERE fk_entity_id = v_entity_id;
    DECLARE CONTINUE HANDLER FOR NOT FOUND SET done = TRUE;

    SELECT entity_id INTO v_entity_id FROM t_entity WHERE entity_type = p_entity_type;
    IF v_entity_id IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Entity type not found';
    END IF;

    SET v_attr_len = get_list_length(p_attribute_names);
    SET v_val_len = get_list_length(p_values);

    IF v_attr_len != v_val_len THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Attributes and values length mismatch';
    END IF;

    SET v_instance_id = NEXTVAL(seq_entity_instance_id);

    OPEN cur_attrs;
    read_loop: LOOP
        FETCH cur_attrs INTO v_attr_id, v_attr_name_db, v_attr_is_unique;
        IF done THEN LEAVE read_loop; END IF;

        -- Find value in input list corresponding to db attribute
        SET v_found_idx = -1;
        SET v_idx = 1;
        WHILE v_idx <= v_attr_len DO
            IF LOWER(get_list_element(p_attribute_names, v_idx)) = LOWER(v_attr_name_db) THEN
                SET v_found_idx = v_idx;
                SET v_idx = v_attr_len + 1;
            END IF;
            SET v_idx = v_idx + 1;
        END WHILE;

        IF v_found_idx != -1 THEN
            SET v_val = get_list_element(p_values, v_found_idx);
            INSERT INTO t_values(fk_attribute_id, value, entity_instance_id)
            VALUES (v_attr_id, v_val, v_instance_id);
        ELSEIF v_attr_is_unique THEN
            -- PK attribute not provided: auto-fill with instance_id
            INSERT INTO t_values(fk_attribute_id, value, entity_instance_id)
            VALUES (v_attr_id, v_instance_id, v_instance_id);
        ELSE
            -- Attribute not provided: fill with NULL
            INSERT INTO t_values(fk_attribute_id, value, entity_instance_id)
            VALUES (v_attr_id, NULL, v_instance_id);
        END IF;
    END LOOP;
    CLOSE cur_attrs;
END //

CREATE OR REPLACE PROCEDURE create_relation(
    IN p_name             VARCHAR(255),
    IN p_type             VARCHAR(50),
    IN p_description      TEXT,
    OUT p_relation_id     INT
)
BEGIN
    SELECT relation_id INTO p_relation_id FROM t_relation WHERE name = p_name LIMIT 1;

    IF p_relation_id IS NULL THEN
        INSERT INTO t_relation (name, type, description) 
        VALUES (p_name, p_type, p_description);
        SET p_relation_id = LAST_INSERT_ID();
    END IF;
END //

CREATE OR REPLACE PROCEDURE add_relation_participant(
    IN p_relation_id      INT,
    IN p_entity_type      TEXT,
    IN p_card_min         INT,
    IN p_card_max         INT
)
BEGIN
    DECLARE v_entity_id INT;
    DECLARE v_pk_att_id INT;
    DECLARE v_rel_att_id INT;
    DECLARE v_datatype_id INT;
    DECLARE v_fk_attr_name VARCHAR(255);

    SELECT entity_id INTO v_entity_id FROM t_entity WHERE entity_type = p_entity_type;
    
    SELECT attribute_id, fk_datatype_id INTO v_pk_att_id, v_datatype_id 
    FROM t_attribute 
    WHERE fk_entity_id = v_entity_id AND attribute_name = CONCAT(p_entity_type, '_id');

    SET v_fk_attr_name = CONCAT('fk_', p_entity_type, '_id');

    -- Check if FK attribute already exists to avoid duplicates
    SELECT attribute_id INTO v_rel_att_id 
    FROM t_attribute 
    WHERE attribute_name = v_fk_attr_name AND fk_entity_id IS NULL
    LIMIT 1;

    IF v_rel_att_id IS NULL THEN
        INSERT INTO t_attribute(fk_entity_id, fk_datatype_id, attribute_name, is_unique)
        VALUES (NULL, v_datatype_id, v_fk_attr_name, FALSE);
        
        SET v_rel_att_id = LAST_INSERT_ID();
    END IF;

    INSERT INTO t_relation_participant (fk_relation_id, card_min, card_max, fk_att_id, fk_att_id_rel)
    VALUES (p_relation_id, p_card_min, p_card_max, v_pk_att_id, v_rel_att_id);
END //

CREATE OR REPLACE PROCEDURE add_relation_attribute(
    IN p_relation_id          INT,
    IN p_attribute_name       VARCHAR(255),
    IN p_datatype             VARCHAR(100),
    IN p_isInputField         BOOLEAN,
    IN p_isRequired           BOOLEAN,
    IN p_isSingularRessource  BOOLEAN,
    IN p_expirationDate       DATE
)
BEGIN
    DECLARE v_datatype_id INT;
    DECLARE v_attr_id INT;
    DECLARE v_access ENUM('read_public', 'write_public', 'teachers_only', 'owner_only');

    SELECT datatype_id INTO v_datatype_id FROM t_datatype WHERE datatype = p_datatype;

    -- InputFields get write_public access; otherwise default read_public
    SET v_access = IF(IFNULL(p_isInputField, FALSE), 'write_public', 'read_public');

    INSERT INTO t_attribute(
        fk_entity_id, fk_datatype_id, attribute_name, is_unique,
        isInputField, isRequired, isSingularRessource,
        access, expirationDate
    )
    VALUES (
        NULL, v_datatype_id, p_attribute_name, FALSE,
        IFNULL(p_isInputField, FALSE), IFNULL(p_isRequired, FALSE), IFNULL(p_isSingularRessource, FALSE),
        v_access, p_expirationDate
    );
    
    SET v_attr_id = LAST_INSERT_ID();

    INSERT INTO t_relation_participant (fk_relation_id, card_min, card_max, fk_att_id, fk_att_id_rel)
    VALUES (p_relation_id, 0, NULL, v_attr_id, v_attr_id);
END //

CREATE OR REPLACE PROCEDURE create_relation_attribute_value(
    IN p_relation_id      INT,
    IN p_attribute_name   VARCHAR(255),
    IN p_value            VARCHAR(1000),
    OUT p_value_id        INT
)
BEGIN
    DECLARE v_attr_id INT;

    SELECT a.attribute_id INTO v_attr_id 
    FROM t_attribute a
    JOIN t_relation_participant rp ON a.attribute_id = rp.fk_att_id_rel
    WHERE rp.fk_relation_id = p_relation_id AND rp.fk_att_id = rp.fk_att_id_rel
      AND a.attribute_name = p_attribute_name;

    INSERT INTO t_values(fk_attribute_id, value, entity_instance_id)
    VALUES (v_attr_id, p_value, NULL);
    SET p_value_id = LAST_INSERT_ID();
END //

CREATE OR REPLACE PROCEDURE create_relation_instance(
    IN p_relation_id       INT,
    IN p_value_ids         TEXT,
    OUT p_rel_instance_id  INT
)
BEGIN
    DECLARE v_value_id INT;
    DECLARE v_ent_attr_id INT;
    DECLARE v_rel_attr_id INT;
    DECLARE i INT DEFAULT 1;
    DECLARE v_len INT;

    SET v_len = get_list_length(p_value_ids);
    SET p_rel_instance_id = NEXTVAL(seq_relation_instance_id);

    WHILE i <= v_len DO
        SET v_value_id = CAST(get_list_element(p_value_ids, i) AS UNSIGNED);
        
        SELECT fk_attribute_id INTO v_ent_attr_id FROM t_values WHERE value_id = v_value_id;
        
        SELECT fk_att_id_rel INTO v_rel_attr_id 
        FROM t_relation_participant 
        WHERE fk_relation_id = p_relation_id AND fk_att_id = v_ent_attr_id;

        INSERT INTO t_relation_values(fk_relation_id, fk_attribute_id, fk_value_id, relation_instance_id)
        VALUES (p_relation_id, v_rel_attr_id, v_value_id, p_rel_instance_id);

        SET i = i + 1;
    END WHILE;
END //

-- --- FROM crud_read.sql ---
CREATE OR REPLACE PROCEDURE get_entity_instances(IN p_entity_type TEXT, IN p_isEvent BOOLEAN)
BEGIN
    IF p_isEvent THEN
        SELECT v.entity_instance_id, a.attribute_name, v.value
        FROM t_values v
        JOIN t_attribute a ON v.fk_attribute_id = a.attribute_id
        JOIN t_entity e ON a.fk_entity_id = e.entity_id
        WHERE e.isEvent = TRUE
        ORDER BY v.entity_instance_id, a.attribute_name;
    ELSE
        SELECT v.entity_instance_id, a.attribute_name, v.value
        FROM t_values v
        JOIN t_attribute a ON v.fk_attribute_id = a.attribute_id
        JOIN t_entity e ON a.fk_entity_id = e.entity_id
        WHERE e.entity_type = p_entity_type AND e.isEvent = FALSE
        ORDER BY v.entity_instance_id, a.attribute_name;
    END IF;
END //

CREATE OR REPLACE PROCEDURE get_entity_instance_by_id(IN p_entity_instance_id INT, IN p_isEvent BOOLEAN)
BEGIN
    IF p_isEvent THEN
        SELECT v.entity_instance_id, a.attribute_name, v.value
        FROM t_values v
        JOIN t_attribute a ON v.fk_attribute_id = a.attribute_id
        JOIN t_entity e ON a.fk_entity_id = e.entity_id
        WHERE e.isEvent = TRUE AND v.entity_instance_id = p_entity_instance_id
        ORDER BY v.entity_instance_id, a.attribute_name;
    ELSE
        SELECT v.entity_instance_id, a.attribute_name, v.value
        FROM t_values v
        JOIN t_attribute a ON v.fk_attribute_id = a.attribute_id
        JOIN t_entity e ON a.fk_entity_id = e.entity_id
        WHERE e.isEvent = FALSE AND v.entity_instance_id = p_entity_instance_id
        ORDER BY v.entity_instance_id, a.attribute_name;
    END IF;
END //

CREATE OR REPLACE PROCEDURE get_relation_data(IN p_relation_id INT)
BEGIN
    SELECT 
        rv.relation_instance_id,
        CAST(e.entity_type AS CHAR) AS participant_entity,
        CAST(a.attribute_name AS CHAR) AS participant_attribute,
        CAST(v.value AS CHAR) AS participant_value
    FROM t_relation_values rv
    JOIN t_values v ON rv.fk_value_id = v.value_id
    JOIN t_attribute a ON rv.fk_attribute_id = a.attribute_id
    LEFT JOIN t_entity e ON a.fk_entity_id = e.entity_id
    WHERE rv.fk_relation_id = p_relation_id
    ORDER BY rv.relation_instance_id;
END //

CREATE OR REPLACE PROCEDURE get_relations_for_entity(IN p_instance_id INT)
BEGIN
    SELECT 
        r.relation_id,
        r.name AS relation_name,
        r.type AS relation_type,
        rv.relation_instance_id,
        a.attribute_name,
        v.value
    FROM t_relation_values rv
    JOIN t_relation r ON rv.fk_relation_id = r.relation_id
    JOIN t_values v ON rv.fk_value_id = v.value_id
    JOIN t_attribute a ON rv.fk_attribute_id = a.attribute_id
    WHERE rv.relation_instance_id IN (
        SELECT rv2.relation_instance_id
        FROM t_relation_values rv2
        JOIN t_values v2 ON rv2.fk_value_id = v2.value_id
        WHERE v2.entity_instance_id = p_instance_id
    )
    ORDER BY r.relation_id, rv.relation_instance_id, a.attribute_name;
END //


-- =====> Claude Opus 4.6 - Datum 3.3.2026
-- counts of isInputField, isListRessource, isPersonRessource, isSingularRessource, isRequired attributes
-- Includes BOTH entity attributes (direct) AND relation attributes (via relations)
-- so that e.g. nimmtTeil (isInputField on a relation) appears in cnt_input_fields
-- Formula: cnt_ressources = cnt_person_ressources + cnt_list_ressources + cnt_singular_ressources
CREATE OR REPLACE PROCEDURE get_event_attribute_statistics(
    IN p_event_instance_id INT
)
BEGIN
    SELECT
        sub.event_name,
        sub.event_instance_id,

        -- Attribute flag counts
        SUM(sub.isInputField)                                       AS cnt_input_fields,
        SUM(sub.isListRessource)                                    AS cnt_list_ressources,
        SUM(sub.isPersonRessource)                                  AS cnt_person_ressources,
        SUM(sub.isSingularRessource)                                AS cnt_singular_ressources,
        SUM(sub.isRequired)                                         AS cnt_required,

        -- Total resources = person + list + singular
        SUM(sub.isPersonRessource) + SUM(sub.isListRessource) + SUM(sub.isSingularRessource) AS cnt_ressources,

        -- Filled / missing based on flags
        SUM(CASE WHEN sub.isRequired   AND sub.is_filled THEN 1 ELSE 0 END) AS cnt_required_filled,
        SUM(CASE WHEN sub.isRequired   AND NOT sub.is_filled THEN 1 ELSE 0 END) AS cnt_required_missing,
        SUM(CASE WHEN sub.isInputField AND sub.is_filled THEN 1 ELSE 0 END) AS cnt_input_fields_filled,
        SUM(CASE WHEN (sub.isListRessource OR sub.isPersonRessource OR sub.isSingularRessource) AND sub.is_filled THEN 1 ELSE 0 END) AS cnt_ressources_filled,
        COUNT(*)                                                    AS cnt_total_attributes

    FROM (
        -- ---------------------------------------------------------------
        -- Part 1: Direct entity attributes of the event
        -- ---------------------------------------------------------------
        SELECT
            v_name.value                          AS event_name,
            v_ev.entity_instance_id                AS event_instance_id,
            a.attribute_id,
            a.isInputField,
            a.isListRessource,
            a.isPersonRessource,
            a.isSingularRessource,
            a.isRequired,
            (v_ev.value IS NOT NULL AND v_ev.value != '') AS is_filled
        FROM t_values v_ev
        JOIN t_attribute a ON v_ev.fk_attribute_id = a.attribute_id
        JOIN t_entity   e ON a.fk_entity_id = e.entity_id
        LEFT JOIN (
            SELECT v2.entity_instance_id, v2.value
            FROM t_values v2
            JOIN t_attribute a2 ON v2.fk_attribute_id = a2.attribute_id
            WHERE LOWER(a2.attribute_name) = 'name'
        ) v_name ON v_name.entity_instance_id = v_ev.entity_instance_id
        WHERE e.isEvent = TRUE
          AND (p_event_instance_id IS NULL OR v_ev.entity_instance_id = p_event_instance_id)

        UNION ALL

        -- ---------------------------------------------------------------
        -- Part 2: Relation attributes connected to the event
        --   (e.g. reg_date, nimmtTeil, hours, room_note)
        --   Each relation-attribute VALUE (instance) is counted individually,
        --   so 2 participants each contributing reg_date => 2 rows.
        -- ---------------------------------------------------------------
        SELECT
            v_name.value                          AS event_name,
            v_event.entity_instance_id              AS event_instance_id,
            a_rel.attribute_id,
            a_rel.isInputField,
            a_rel.isListRessource,
            a_rel.isPersonRessource,
            a_rel.isSingularRessource,
            a_rel.isRequired,
            (v_relval.value IS NOT NULL AND v_relval.value != '') AS is_filled
        FROM t_relation_values rv_event
        -- Join the event's PK value that sits in this relation instance
        JOIN t_values     v_event  ON rv_event.fk_value_id = v_event.value_id
        JOIN t_attribute  a_event  ON v_event.fk_attribute_id = a_event.attribute_id
        JOIN t_entity     e        ON a_event.fk_entity_id = e.entity_id AND e.isEvent = TRUE
        -- Find relation attribute entries in the same relation instance
        JOIN t_relation_values rv_attr ON rv_attr.relation_instance_id = rv_event.relation_instance_id
                                      AND rv_attr.fk_relation_id      = rv_event.fk_relation_id
        JOIN t_attribute a_rel ON rv_attr.fk_attribute_id = a_rel.attribute_id
                              AND a_rel.fk_entity_id IS NULL
                              AND a_rel.attribute_name NOT LIKE 'fk\_%' ESCAPE '\\'
        JOIN t_values v_relval ON rv_attr.fk_value_id = v_relval.value_id
        LEFT JOIN (
            SELECT v2.entity_instance_id, v2.value
            FROM t_values v2
            JOIN t_attribute a2 ON v2.fk_attribute_id = a2.attribute_id
            WHERE LOWER(a2.attribute_name) = 'name'
        ) v_name ON v_name.entity_instance_id = v_event.entity_instance_id
        WHERE (p_event_instance_id IS NULL OR v_event.entity_instance_id = p_event_instance_id)
    ) sub
    GROUP BY sub.event_instance_id, sub.event_name
    ORDER BY sub.event_instance_id;
END //

-- Returns individual attribute details for a specific event instance
-- Lists each attribute with its flags and source (entity / relation)
CREATE OR REPLACE PROCEDURE get_event_attribute_details(
    IN p_event_instance_id INT
)
BEGIN
    SELECT
        sub2.attribute_name,
        sub2.source,
        sub2.isInputField,
        sub2.isListRessource,
        sub2.isPersonRessource,
        sub2.isSingularRessource,
        sub2.isRequired,
        sub2.is_filled
    FROM (
        -- Direct entity attributes
        SELECT
            a.attribute_name,
            'entity' AS source,
            a.isInputField,
            a.isListRessource,
            a.isPersonRessource,
            a.isSingularRessource,
            a.isRequired,
            (v_ev.value IS NOT NULL AND v_ev.value != '') AS is_filled
        FROM t_values v_ev
        JOIN t_attribute a ON v_ev.fk_attribute_id = a.attribute_id
        JOIN t_entity   e ON a.fk_entity_id = e.entity_id
        WHERE e.isEvent = TRUE
          AND v_ev.entity_instance_id = p_event_instance_id

        UNION ALL

        -- Relation attributes
        SELECT
            a_rel.attribute_name,
            'relation' AS source,
            a_rel.isInputField,
            a_rel.isListRessource,
            a_rel.isPersonRessource,
            a_rel.isSingularRessource,
            a_rel.isRequired,
            MAX(v_relval.value IS NOT NULL AND v_relval.value != '') AS is_filled
        FROM t_relation_values rv_event
        JOIN t_values     v_event  ON rv_event.fk_value_id = v_event.value_id
        JOIN t_attribute  a_event  ON v_event.fk_attribute_id = a_event.attribute_id
        JOIN t_entity     e        ON a_event.fk_entity_id = e.entity_id AND e.isEvent = TRUE
        JOIN t_relation_values rv_attr ON rv_attr.relation_instance_id = rv_event.relation_instance_id
                                      AND rv_attr.fk_relation_id      = rv_event.fk_relation_id
        JOIN t_attribute a_rel ON rv_attr.fk_attribute_id = a_rel.attribute_id
                              AND a_rel.fk_entity_id IS NULL
                              AND a_rel.attribute_name NOT LIKE 'fk\_%' ESCAPE '\\'
        JOIN t_values v_relval ON rv_attr.fk_value_id = v_relval.value_id
        WHERE v_event.entity_instance_id = p_event_instance_id
        GROUP BY a_rel.attribute_id, a_rel.attribute_name
    ) sub2
    ORDER BY sub2.source, sub2.attribute_name;
END //

-- --- FROM crud_update.sql ---
CREATE OR REPLACE PROCEDURE update_attribute(
    IN p_entity_type          TEXT,
    IN p_old_attribute_name   VARCHAR(255),
    IN p_new_attribute_name   VARCHAR(255),
    IN p_new_datatype         VARCHAR(100)
)
BEGIN
    DECLARE v_entity_id INT;
    DECLARE v_attr_id INT;
    DECLARE v_new_datatype_id INT;

    -- Validate entity
    SELECT entity_id INTO v_entity_id FROM t_entity WHERE entity_type = p_entity_type;
    IF v_entity_id IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Entity type not found';
    END IF;

    -- Find attribute
    SELECT attribute_id INTO v_attr_id
    FROM t_attribute
    WHERE fk_entity_id = v_entity_id AND LOWER(attribute_name) = LOWER(p_old_attribute_name);

    IF v_attr_id IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Attribute not found for this entity';
    END IF;

    -- Prevent renaming of PK attribute
    IF (SELECT is_unique FROM t_attribute WHERE attribute_id = v_attr_id) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Cannot modify primary key attribute';
    END IF;

    -- Check for duplicate name (only if name actually changes)
    IF LOWER(p_old_attribute_name) != LOWER(p_new_attribute_name) THEN
        IF EXISTS (
            SELECT 1 FROM t_attribute
            WHERE fk_entity_id = v_entity_id AND LOWER(attribute_name) = LOWER(p_new_attribute_name)
        ) THEN
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'An attribute with that name already exists';
        END IF;
    END IF;

    -- Validate new datatype
    SELECT datatype_id INTO v_new_datatype_id FROM t_datatype WHERE datatype = p_new_datatype;
    IF v_new_datatype_id IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Datatype not found';
    END IF;

    -- Update attribute
    UPDATE t_attribute
    SET attribute_name = p_new_attribute_name,
        fk_datatype_id = v_new_datatype_id
    WHERE attribute_id = v_attr_id;
END //

CREATE OR REPLACE PROCEDURE update_entity_instance(
    IN p_instance_id      INT,
    IN p_attribute_names  TEXT,
    IN p_new_values       TEXT
)
BEGIN
    DECLARE v_attr_len INT;
    DECLARE v_idx INT DEFAULT 1;
    DECLARE v_curr_attr_name TEXT;
    DECLARE v_curr_val TEXT;
    DECLARE v_attr_id INT;

    SET v_attr_len = get_list_length(p_attribute_names);

    IF v_attr_len != get_list_length(p_new_values) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Arrays length mismatch';
    END IF;

    WHILE v_idx <= v_attr_len DO
        SET v_curr_attr_name = get_list_element(p_attribute_names, v_idx);
        SET v_curr_val = get_list_element(p_new_values, v_idx);

        -- Find attribute ID for this instance
        SELECT DISTINCT a.attribute_id INTO v_attr_id
        FROM t_values v
        JOIN t_attribute a ON v.fk_attribute_id = a.attribute_id
        WHERE v.entity_instance_id = p_instance_id
          AND LOWER(a.attribute_name) = LOWER(v_curr_attr_name)
        LIMIT 1;

        IF v_attr_id IS NOT NULL THEN
            UPDATE t_values 
            SET value = v_curr_val 
            WHERE entity_instance_id = p_instance_id AND fk_attribute_id = v_attr_id;
        END IF;

        SET v_idx = v_idx + 1;
    END WHILE;
END //

CREATE OR REPLACE PROCEDURE update_relation_attribute_value(
    IN p_rel_instance_id  INT,
    IN p_attribute_name   VARCHAR(255),
    IN p_new_value        VARCHAR(1000)
)
BEGIN
    DECLARE v_val_id INT;

    SELECT v.value_id INTO v_val_id
    FROM t_relation_values rv
    JOIN t_values v ON rv.fk_value_id = v.value_id
    JOIN t_attribute a ON rv.fk_attribute_id = a.attribute_id
    WHERE rv.relation_instance_id = p_rel_instance_id
      AND a.attribute_name = p_attribute_name;

    IF v_val_id IS NOT NULL THEN
        UPDATE t_values SET value = p_new_value WHERE value_id = v_val_id;
    ELSE
         SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Attribute not found';
    END IF;
END //

-- --- FROM crud_delete.sql ---
CREATE OR REPLACE PROCEDURE delete_entity_instance(
    IN p_instance_id INT
)
BEGIN
    -- Delete values corresponding to instance
    -- Relation values linked via CASCADE should be handled by DB constraints if configured, 
    -- if not, we must manually delete from t_relation_values first.
    -- Check table definitions for ON DELETE CASCADE.
    
    DELETE FROM t_values WHERE entity_instance_id = p_instance_id;
    
    IF ROW_COUNT() = 0 THEN
         SIGNAL SQLSTATE '02000' SET MESSAGE_TEXT = 'No instance found with that ID';
    END IF;
END //

CREATE OR REPLACE PROCEDURE delete_relation_instance(
    IN p_rel_instance_id INT
)
BEGIN
    DECLARE done INT DEFAULT FALSE;
    DECLARE v_val_id INT;
    
    -- Cursor for custom values (no entity instance id) involved in relation
    DECLARE cur_rel_vals CURSOR FOR 
        SELECT rv.fk_value_id FROM t_relation_values rv
        JOIN t_values v ON rv.fk_value_id = v.value_id
        WHERE rv.relation_instance_id = p_rel_instance_id
        AND v.entity_instance_id IS NULL; -- Only delete custom attributes (e.g. date), not Participants
        
    DECLARE CONTINUE HANDLER FOR NOT FOUND SET done = TRUE;

    OPEN cur_rel_vals;
    read_loop: LOOP
        FETCH cur_rel_vals INTO v_val_id;
        IF done THEN LEAVE read_loop; END IF;
        DELETE FROM t_values WHERE value_id = v_val_id;
    END LOOP;
    CLOSE cur_rel_vals;

    DELETE FROM t_relation_values WHERE relation_instance_id = p_rel_instance_id;
END //

CREATE OR REPLACE PROCEDURE delete_attribute(
    IN p_entity_type      TEXT,
    IN p_attribute_name   VARCHAR(255)
)
BEGIN
    DECLARE v_entity_id INT;
    DECLARE v_attr_id INT;

    -- Validate entity
    SELECT entity_id INTO v_entity_id FROM t_entity WHERE entity_type = p_entity_type;
    IF v_entity_id IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Entity type not found';
    END IF;

    -- Find attribute
    SELECT attribute_id INTO v_attr_id
    FROM t_attribute
    WHERE fk_entity_id = v_entity_id AND LOWER(attribute_name) = LOWER(p_attribute_name);

    IF v_attr_id IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Attribute not found for this entity';
    END IF;

    -- Prevent deletion of PK attribute
    IF (SELECT is_unique FROM t_attribute WHERE attribute_id = v_attr_id) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Cannot delete primary key attribute';
    END IF;

    -- Delete attribute (CASCADE removes related t_values, t_relation_participant, t_relation_values)
    DELETE FROM t_attribute WHERE attribute_id = v_attr_id;
END //

CREATE OR REPLACE PROCEDURE delete_entity_type(IN p_entity_type TEXT)
BEGIN
    DELETE FROM t_entity WHERE entity_type = p_entity_type;
END //

CREATE OR REPLACE PROCEDURE create_entity_instances_from_users(
    IN p_filter_class VARCHAR(255),
    IN p_filter_name  VARCHAR(255)
)
BEGIN
    DECLARE v_done INT DEFAULT FALSE;
    DECLARE v_user_id INT;
    DECLARE v_display_name VARCHAR(255);
    DECLARE v_email VARCHAR(255);
    DECLARE v_job_title VARCHAR(255);
    DECLARE v_instance_id INT;
    DECLARE v_is_teacher BOOLEAN;
    DECLARE v_class VARCHAR(255);
    DECLARE v_existing_count INT;
    DECLARE v_target_entity VARCHAR(255);

    DECLARE cur_users CURSOR FOR
        SELECT user_id, display_name, email, job_title FROM t_users;
    DECLARE CONTINUE HANDLER FOR NOT FOUND SET v_done = TRUE;

    OPEN cur_users;
    user_loop: LOOP
        FETCH cur_users INTO v_user_id, v_display_name, v_email, v_job_title;
        IF v_done THEN LEAVE user_loop; END IF;

        -- Bestimme ob Lehrer oder Schüler
        IF v_job_title IS NULL OR LOWER(v_job_title) = 'teacher' THEN
            SET v_is_teacher = TRUE;
            SET v_class = NULL;
        ELSE
            SET v_is_teacher = FALSE;
            SET v_class = v_job_title;  -- job_title enthält die Klasse
        END IF;

        -- Filter nach Klasse/Typ
        IF p_filter_class IS NOT NULL THEN
            IF LOWER(p_filter_class) = 'teacher' AND v_is_teacher = FALSE THEN
                ITERATE user_loop;
            END IF;
            IF LOWER(p_filter_class) != 'teacher' AND (v_is_teacher = TRUE OR LOWER(v_class) != LOWER(p_filter_class)) THEN
                ITERATE user_loop;
            END IF;
        END IF;

        -- Filter nach Name
        IF p_filter_name IS NOT NULL THEN
            IF v_display_name NOT LIKE CONCAT('%', p_filter_name, '%') THEN
                ITERATE user_loop;
            END IF;
        END IF;

        -- Duplikat-Prüfung: Existiert bereits eine Instanz mit derselben E-Mail?
        SET v_target_entity = IF(v_is_teacher, 'Teacher', 'Student');
        SELECT COUNT(*) INTO v_existing_count
        FROM t_values v
        JOIN t_attribute a ON v.fk_attribute_id = a.attribute_id
        JOIN t_entity e ON a.fk_entity_id = e.entity_id
        WHERE e.entity_type = v_target_entity
          AND LOWER(a.attribute_name) = 'email'
          AND LOWER(v.value) = LOWER(v_email);

        IF v_existing_count > 0 THEN
            ITERATE user_loop;
        END IF;

        -- Entitätsinstanz erstellen
        IF v_is_teacher THEN
            CALL create_entity_instance(
                'Teacher',
                'name,email,uid,Teacher_id',
                CONCAT(v_display_name, ',', v_email, ',', v_user_id, ',', v_user_id)
            );
        ELSE
            CALL create_entity_instance(
                'Student',
                'name,email,class,uid,Student_id',
                CONCAT(v_display_name, ',', v_email, ',', v_class, ',', v_user_id, ',', v_user_id)
            );
        END IF;
    END LOOP;
    CLOSE cur_users;
END //

DELIMITER ;

-- ============================================================================
-- EVENT: Automatically shift access to 'read' when expirationDate has elapsed
-- Runs daily at midnight. Requires: SET GLOBAL event_scheduler = ON;
-- ============================================================================
SET GLOBAL event_scheduler = ON;

DROP EVENT IF EXISTS evt_expire_attribute_access;

CREATE EVENT evt_expire_attribute_access
    ON SCHEDULE EVERY 1 DAY
    STARTS CURRENT_DATE + INTERVAL 0 SECOND
    DO
        UPDATE t_attribute
        SET access = 'read_public'
        WHERE expirationDate IS NOT NULL
          AND expirationDate < CURDATE()
          AND access != 'read_public';

-- ============================================================================
-- PART 3: Data Population (Entities, Instances, Relations)
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. USERS (MS Graph data)
-- ---------------------------------------------------------------------------

SET FOREIGN_KEY_CHECKS = 0;
TRUNCATE TABLE t_relation_values;
TRUNCATE TABLE t_relation_participant;
TRUNCATE TABLE t_relation;
TRUNCATE TABLE t_values;
TRUNCATE TABLE t_attribute;
TRUNCATE TABLE t_entity;
TRUNCATE TABLE t_user_preferences;
TRUNCATE TABLE t_preferences;
TRUNCATE TABLE t_users;
DROP SEQUENCE IF EXISTS seq_entity_instance_id;
DROP SEQUENCE IF EXISTS seq_relation_instance_id;
CREATE SEQUENCE seq_entity_instance_id;
CREATE SEQUENCE seq_relation_instance_id;
SET FOREIGN_KEY_CHECKS = 1;

SELECT '--- 1. INSERT USERS (MS Graph) ---' AS Step;
INSERT INTO t_users (display_name, email, job_title) VALUES
    ('Max Mustermann',  'mm@htlwy.com',    'Student'),
    ('Anna Musterfrau', 'am@htlwy.com',    'Student'),
    ('Mr. Smith',       'smith@htlwy.com', 'Teacher');

-- ---------------------------------------------------------------------------
-- 2. PREFERENCES
-- ---------------------------------------------------------------------------
SELECT '--- 2. INSERT PREFERENCES ---' AS Step;
INSERT INTO t_preferences (theme) VALUES
    ('dark'),   -- preference_id = 1 (Max)
    ('light'),  -- preference_id = 2 (Anna)
    ('light');  -- preference_id = 3 (Smith)

-- ---------------------------------------------------------------------------
-- 3. USER <-> PREFERENCES (1:1)
-- ---------------------------------------------------------------------------
SELECT '--- 3. LINK USERS TO PREFERENCES ---' AS Step;
INSERT INTO t_user_preferences (user_id, preference_id) VALUES
    (1, 1),  -- Max   -> dark/de
    (2, 2),  -- Anna  -> light/de
    (3, 3);  -- Smith -> light/en

-- ---------------------------------------------------------------------------
-- 4. ENTITY TYPES
-- ---------------------------------------------------------------------------
SELECT '--- 4. CREATE ENTITY TYPES ---' AS Step;
-- create_entity_with_attributes(type, attributes, datatypes, isEvent, isRequired_flags)
-- All entity attributes are automatically isListRessource=TRUE (and isPersonRessource=TRUE for Student/Teacher)
--   Student: name(required), email(required), class, uid
CALL create_entity_with_attributes('Student', 'name,email,class,uid',    'VARCHAR,VARCHAR,VARCHAR,INTEGER', FALSE, '1,1,0,0');
--   Event: name(required), date(required), location
--   CALL create_entity_with_attributes('Event',   'name,date,location',      'VARCHAR,DATE,VARCHAR',            TRUE,  '1,1,0');
--   Teacher: name(required), email(required), uid
CALL create_entity_with_attributes('Teacher', 'name,email,uid',          'VARCHAR,VARCHAR,INTEGER',         FALSE, '1,1,0');
--   Room: name(required), capacity
CALL create_entity_with_attributes('Room',    'name,capacity',           'VARCHAR,INTEGER',                 FALSE, '1,0');

-- ---------------------------------------------------------------------------
-- 5. ENTITY INSTANCES
-- ---------------------------------------------------------------------------
SELECT '--- 5. CREATE ENTITY INSTANCES ---' AS Step;
--                                                          entity_instance_id (seq):
-- Students
CALL create_entity_instance('Student', 'name,email,class,uid,Student_id', 'Max Mustermann,mm@htlwy.com,5AHIT,1,1');   -- 1
CALL create_entity_instance('Student', 'name,email,class,uid,Student_id', 'Anna Musterfrau,am@htlwy.com,5AHIT,2,2');  -- 2
CALL create_entity_instance('Student', 'name,email,class,uid,Student_id', 'Lukas Huber,lh@htlwy.com,4BHIT,,3');       -- 3
-- Events
/*
CALL create_entity_instance('Event',   'name,date,location,Event_id', 'Skikurs,2026-03-01,Saalbach,1');               -- 4
CALL create_entity_instance('Event',   'name,date,location,Event_id', 'Science Fair,2025-06-20,School Hall,2');        -- 5
CALL create_entity_instance('Event',   'name,date,location,Event_id', 'Tag der offenen Tuer,2026-04-15,HTL Wels,3');  -- 6
*/
-- Teachers
CALL create_entity_instance('Teacher', 'name,email,uid,Teacher_id', 'Mr. Smith,smith@htlwy.com,3,1');                  -- 7
CALL create_entity_instance('Teacher', 'name,email,uid,Teacher_id', 'Frau Huber,huber@htlwy.com,,2');                  -- 8
-- Rooms
CALL create_entity_instance('Room',    'name,capacity,Room_id', 'Aula,200,1');                                         -- 9
CALL create_entity_instance('Room',    'name,capacity,Room_id', 'EDV-Saal 1,30,2');                                    -- 10

-- ---------------------------------------------------------------------------
-- 6. RELATION DEFINITIONS
-- ---------------------------------------------------------------------------
/*
SELECT '--- 6. DEFINE RELATIONS ---' AS Step;
-- add_relation_attribute(relation_id, name, datatype, isInputField, isRequired, isSingularRessource, expirationDate)

-- relation_id=1: participates_in
CALL create_relation('participates_in', 'm:n', 'Student participates in Event', @_);
CALL add_relation_participant(1, 'Student', 0, 15);
CALL add_relation_participant(1, 'Event',   0, NULL);
-- reg_date: isInputField=TRUE, isRequired=TRUE, expires 2026-06-30
CALL add_relation_attribute(1, 'reg_date', 'DATE', TRUE, TRUE, FALSE, '2026-06-30');
-- nimmtTeil: isInputField=TRUE, not required, not singular, no expiration
CALL add_relation_attribute(1, 'nimmtTeil', 'BOOLEAN', TRUE, FALSE, FALSE, NULL);

-- relation_id=2: organizes
CALL create_relation('organizes', '1:n', 'Teacher organizes Event', @_);
CALL add_relation_participant(2, 'Teacher', 1, 1);
CALL add_relation_participant(2, 'Event',   0, NULL);
-- hours: isInputField=TRUE, not required, not singular
CALL add_relation_attribute(2, 'hours', 'INTEGER', TRUE, FALSE, FALSE, NULL);

-- relation_id=3: takes_place_in
CALL create_relation('takes_place_in', '1:n', 'Event takes place in Room', @_);
CALL add_relation_participant(3, 'Event', 0, NULL);
CALL add_relation_participant(3, 'Room',  0, NULL);
-- room_note: isInputField, isSingularRessource (only one room per event), required, expires 2026-12-31
CALL add_relation_attribute(3, 'room_note', 'VARCHAR', TRUE, TRUE, TRUE, '2026-12-31');

-- ---------------------------------------------------------------------------
-- 7. RELATION INSTANCES
-- ---------------------------------------------------------------------------
-- value_id mapping (t_values):
--   Student_id: Max=1,  Anna=6,  Lukas=11
--   Event_id:   Skikurs=16, ScienceFair=20, TdoT=24
--   Teacher_id: Smith=28, Huber=32
--   Room_id:    Aula=36, EDV-Saal1=39
--   (value_ids 42–56 created below in insertion order)
SELECT '--- 7. CREATE RELATION INSTANCES ---' AS Step;

-- participates_in: Max -> Skikurs        (reg_date=2025-12-25, nimmtTeil=1)
CALL create_relation_attribute_value(1, 'reg_date', '2025-12-25', @_);    -- 42
CALL create_relation_attribute_value(1, 'nimmtTeil', '1', @_);            -- 43
CALL create_relation_instance(1, '1,16,42,43', @_);

-- participates_in: Anna -> Skikurs       (reg_date=2026-01-15, nimmtTeil=1)
CALL create_relation_attribute_value(1, 'reg_date', '2026-01-15', @_);    -- 44
CALL create_relation_attribute_value(1, 'nimmtTeil', '1', @_);            -- 45
CALL create_relation_instance(1, '6,16,44,45', @_);

-- participates_in: Max -> Science Fair   (reg_date=2025-05-10, nimmtTeil=1)
CALL create_relation_attribute_value(1, 'reg_date', '2025-05-10', @_);    -- 46
CALL create_relation_attribute_value(1, 'nimmtTeil', '1', @_);            -- 47
CALL create_relation_instance(1, '1,20,46,47', @_);

-- participates_in: Lukas -> Science Fair (reg_date=2025-05-12, nimmtTeil=0 -> nimmt nicht teil)
CALL create_relation_attribute_value(1, 'reg_date', '2025-05-12', @_);    -- 48
CALL create_relation_attribute_value(1, 'nimmtTeil', '0', @_);            -- 49
CALL create_relation_instance(1, '11,20,48,49', @_);

-- participates_in: Anna -> TdoT         (reg_date=2026-03-20, nimmtTeil=1)
CALL create_relation_attribute_value(1, 'reg_date', '2026-03-20', @_);    -- 50
CALL create_relation_attribute_value(1, 'nimmtTeil', '1', @_);            -- 51
CALL create_relation_instance(1, '6,24,50,51', @_);

-- organizes: Smith -> Science Fair       (hours=10)
CALL create_relation_attribute_value(2, 'hours', '10', @_);               -- 52
CALL create_relation_instance(2, '28,20,52', @_);

-- organizes: Huber -> TdoT              (hours=6)
CALL create_relation_attribute_value(2, 'hours', '6', @_);                -- 53
CALL create_relation_instance(2, '32,24,53', @_);

-- takes_place_in: Skikurs -> Aula           (room_note)
CALL create_relation_attribute_value(3, 'room_note', 'Hauptsaal reserviert', @_);  -- 54
CALL create_relation_instance(3, '16,36,54', @_);

-- takes_place_in: Science Fair -> Aula       (room_note)
CALL create_relation_attribute_value(3, 'room_note', 'Bühne benötigt', @_);        -- 55
CALL create_relation_instance(3, '20,36,55', @_);

-- takes_place_in: TdoT -> EDV-Saal 1        (room_note)
CALL create_relation_attribute_value(3, 'room_note', '', @_);                       -- 56
CALL create_relation_instance(3, '24,39,56', @_);

SELECT '--- FILL_DB COMPLETED ---' AS Message;


-- ============================================================================
-- TEST: create_entity_instances_from_users
-- Requires Entity-Types 'Student' and 'Teacher' to already exist (see Part 3 above)
-- ============================================================================
*/
-- Insert test users into t_users
INSERT INTO t_users (display_name, email, job_title) VALUES
    ('Elena Fischer',   'ef@htlwy.com',     '5AHIT'),    -- Student in 5AHIT
    ('Jonas Weber',     'jw@htlwy.com',     '4BHIT'),    -- Student in 4BHIT
    ('Maria Gruber',    'mg@htlwy.com',     '5AHIT'),    -- Student in 5AHIT
    ('Dr. Berger',      'berger@htlwy.com',  'Teacher'),  -- Teacher
    ('Prof. Lang',      'lang@htlwy.com',    NULL);       -- Teacher (job_title NULL)

-- ---------------------------------------------------------------------------
-- Testaufruf 1: Nur Schüler der Klasse 5AHIT importieren
--   Erwartet: Elena Fischer und Maria Gruber werden als Student-Instanzen erstellt
-- ---------------------------------------------------------------------------
-- CALL create_entity_instances_from_users('5AHIT', NULL);

-- ---------------------------------------------------------------------------
-- Testaufruf 2: Nur Lehrer importieren, gefiltert nach Name 'Berger'
--   Erwartet: Nur Dr. Berger wird als Teacher-Instanz erstellt
-- ---------------------------------------------------------------------------
-- CALL create_entity_instances_from_users('Teacher', 'Berger');

-- ---------------------------------------------------------------------------
-- Testaufruf 3: Alle User ohne Filter importieren
--   Erwartet: Alle 5 User werden als Instanzen erstellt (3 Students, 2 Teachers)
--   ACHTUNG: Vorherige Aufrufe ggf. vorher rückgängig machen, um Duplikate zu vermeiden
-- ---------------------------------------------------------------------------
-- CALL create_entity_instances_from_users(NULL, NULL);

-- Test: create_attribute with isRequired=TRUE (isListRessource is always TRUE for entity attributes)
-- CALL create_attribute('Student', 'phone', 'VARCHAR', TRUE);