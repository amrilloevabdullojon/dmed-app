-- PostgreSQL Full-Text Search Migration
-- Run this manually: psql -d your_database -f add_fulltext_search.sql

-- Add tsvector column for full-text search
ALTER TABLE "Letter" ADD COLUMN IF NOT EXISTS search_vector tsvector;

-- Create GIN index for fast full-text search
CREATE INDEX IF NOT EXISTS letter_search_idx ON "Letter" USING GIN (search_vector);

-- Create function to update search vector
CREATE OR REPLACE FUNCTION letter_search_vector_update() RETURNS trigger AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('russian', COALESCE(NEW.number, '')), 'A') ||
    setweight(to_tsvector('russian', COALESCE(NEW.org, '')), 'A') ||
    setweight(to_tsvector('russian', COALESCE(NEW.content, '')), 'B') ||
    setweight(to_tsvector('russian', COALESCE(NEW.answer, '')), 'B') ||
    setweight(to_tsvector('russian', COALESCE(NEW.comment, '')), 'C') ||
    setweight(to_tsvector('russian', COALESCE(NEW.zordoc, '')), 'C') ||
    setweight(to_tsvector('russian', COALESCE(NEW."jiraLink", '')), 'D');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update search vector
DROP TRIGGER IF EXISTS letter_search_vector_trigger ON "Letter";
CREATE TRIGGER letter_search_vector_trigger
  BEFORE INSERT OR UPDATE ON "Letter"
  FOR EACH ROW
  EXECUTE FUNCTION letter_search_vector_update();

-- Update existing records
UPDATE "Letter" SET search_vector =
  setweight(to_tsvector('russian', COALESCE(number, '')), 'A') ||
  setweight(to_tsvector('russian', COALESCE(org, '')), 'A') ||
  setweight(to_tsvector('russian', COALESCE(content, '')), 'B') ||
  setweight(to_tsvector('russian', COALESCE(answer, '')), 'B') ||
  setweight(to_tsvector('russian', COALESCE(comment, '')), 'C') ||
  setweight(to_tsvector('russian', COALESCE(zordoc, '')), 'C') ||
  setweight(to_tsvector('russian', COALESCE("jiraLink", '')), 'D');

-- Example usage in API:
-- SELECT * FROM "Letter"
-- WHERE search_vector @@ plainto_tsquery('russian', 'поисковый запрос')
-- ORDER BY ts_rank(search_vector, plainto_tsquery('russian', 'поисковый запрос')) DESC;
