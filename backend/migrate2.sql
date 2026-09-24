-- Шаг 1: навешиваем FK appointments -> staff
ALTER TABLE appointments ADD CONSTRAINT fk_appointments_staff
    FOREIGN KEY (doctor_id) REFERENCES staff(id) ON DELETE SET NULL;

-- Шаг 2: убираем старую таблицу doctors
DROP TABLE IF EXISTS doctors;
