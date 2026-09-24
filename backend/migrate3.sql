-- Обнуляем doctor_id в appointments где врача нет в таблице staff
UPDATE appointments
SET doctor_id = NULL
WHERE doctor_id IS NOT NULL
  AND doctor_id NOT IN (SELECT id FROM staff);

-- Навешиваем FK
ALTER TABLE appointments ADD CONSTRAINT fk_appointments_staff
    FOREIGN KEY (doctor_id) REFERENCES staff(id) ON DELETE SET NULL;
