-- Delete the duplicate income entries I inserted (ones without masked CPF chars)
DELETE FROM income WHERE id IN (
  '373558af-3746-4eb7-9c0b-f010a24b7222',
  '113ef68f-2933-48a2-8b82-6e26460719f2',
  'cd2557a0-876d-4d7d-97ab-ba08c0fdcf7d',
  'e06337fd-c85f-4d65-9b44-a3907b846e11',
  '2ee00abe-35cf-4923-95bd-9e571629fbc3',
  'ef2be0e9-4247-4ae6-95bc-e08f22082475',
  '967eca81-de57-4ac3-a72b-e97de367f3db',
  '052717df-fdb9-48a5-a145-adde4d998f62',
  '8e7a845d-d6c5-4c5e-99ac-f1eb04c16220',
  '5cde4bb9-e7c5-48b1-8c6c-688887e72960',
  '3084e932-1e6a-477f-ad1d-2cc516b99320'
);

-- Delete the duplicate expense entries I inserted
DELETE FROM expenses WHERE id IN (
  '40c04a8f-17c2-4644-a91f-15377b4d9bcb',
  '604e38a6-f11b-410b-b1d9-4b66d3692750',
  '34938300-6083-4487-9ed4-410b9a998aae',
  '43b6ebda-facd-4b84-a79f-361baac88ea4',
  'b8a6997d-f730-4a78-95b3-ee671d20be34',
  '34e6e4a9-43c2-42de-9ae4-ec5af011fb58'
);