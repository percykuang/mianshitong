UPDATE "QuestionBankItem"
SET "tags" = (
  SELECT to_jsonb(
    ARRAY(
      SELECT DISTINCT normalized_tag
      FROM (
        SELECT
          CASE lower(tag)
            WHEN 'javascript' THEN 'javascript'
            WHEN 'react' THEN 'react'
            WHEN 'vue' THEN 'vue'
            WHEN 'engineering' THEN 'engineering'
            WHEN 'performance' THEN 'performance'
            WHEN 'network' THEN 'network'
            WHEN 'security' THEN 'security'
            WHEN 'node' THEN 'node'
            ELSE tag
          END AS normalized_tag
        FROM jsonb_array_elements_text("tags") AS tag
        UNION ALL
        SELECT
          CASE lower("topic")
            WHEN 'javascript' THEN 'javascript'
            WHEN 'react' THEN 'react'
            WHEN 'vue' THEN 'vue'
            WHEN 'engineering' THEN 'engineering'
            WHEN 'performance' THEN 'performance'
            WHEN 'network' THEN 'network'
            WHEN 'security' THEN 'security'
            WHEN 'node' THEN 'node'
            ELSE "topic"
          END
      ) AS merged
      WHERE normalized_tag <> ''
    )
  )
);

ALTER TABLE "QuestionBankItem" DROP COLUMN "topic";
