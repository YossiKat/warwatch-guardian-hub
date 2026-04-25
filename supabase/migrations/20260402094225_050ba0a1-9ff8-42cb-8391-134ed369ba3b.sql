UPDATE oref_alerts SET alert_date = NOW() - interval '1 minute' WHERE locations @> ARRAY['אשקלון'];
UPDATE oref_alerts SET alert_date = NOW() - interval '2 minutes' WHERE locations @> ARRAY['קריית שמונה'];
UPDATE oref_alerts SET alert_date = NOW() - interval '3 minutes' WHERE locations @> ARRAY['תל אביב'];
UPDATE oref_alerts SET alert_date = NOW() - interval '4 minutes' WHERE locations @> ARRAY['חיפה'];
UPDATE oref_alerts SET alert_date = NOW() - interval '5 minutes' WHERE locations @> ARRAY['באר שבע'];
UPDATE oref_alerts SET alert_date = NOW() - interval '8 minutes' WHERE locations @> ARRAY['ירושלים'];
UPDATE oref_alerts SET alert_date = NOW() - interval '12 minutes' WHERE locations @> ARRAY['עכו'];
UPDATE oref_alerts SET alert_date = NOW() - interval '15 minutes' WHERE locations @> ARRAY['אילת'];