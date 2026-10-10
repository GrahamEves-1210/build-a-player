-- ════════════════════════════════════════════════════════════════════════════
-- Leaderboard cleanup: Sandbox seasons that can be proven
-- ════════════════════════════════════════════════════════════════════════════
-- Run in the Supabase SQL editor, one STEP at a time.
--
-- Removes 510 seasons (90+ OVR) whose build couldn't come from spinning,
-- checked against every version of the game's player data:
--   * a rating the player never had (Drew Lock arm 11, his best ever was 7)
--   * a player who was never in that mode (Brady, Vick in a Current build)
-- Per mode:
--   classic       63
--   all-time      25
--   rb-classic    21
--   rb-all-time  135
--   wr-classic    92
--   wr-all-time   33
--   te-classic     9
--   te-all-time   12
--   db-classic   100
--   db-all-time   20
--
-- Every row is copied to simulations_removed first; STEP 3 puts them back.
-- The game no longer saves Sandbox builds (src/lib/saveGuard.js).

-- ── STEP 1 · Back up, then remove ───────────────────────────────────────────
create table if not exists simulations_removed as
  select s.*, ''::text as removed_reason, now() as removed_at from simulations s where false;

insert into simulations_removed
select s.*, 'sandbox build (proven)', now()
from simulations s
where s.id in (
  '3862e048-1aad-4e3c-be4d-812c5f304879', 'bbc7c6cb-55a7-486f-b145-ee700acb99a4', 'e016f3c0-ef53-42bc-a144-e85564fcb31d', '8767b980-6c34-476c-a2e4-4d118389b913',
  '3769547f-fc0f-4865-843b-48a661d08425', '51667361-9dc6-4440-8135-df96d22d8ca0', '533ede01-fe23-413e-8361-1215aa054033', 'dec153f6-a350-446a-8d58-d7eb04852ad3',
  '15c23990-653c-4b29-8fa1-2afb39c3c338', 'f112d88b-8341-40b6-9b40-c650019d9958', '731cb659-9a97-4add-afea-171f3331d627', 'ac0cfcfc-4dc5-4281-a30a-334d6e22b49a',
  '7a7b6736-27a6-4978-8a5b-c7a7d7e35c9b', '782bc9d0-4668-4733-9a9d-d49a5adb0df5', 'ce13c71a-af4c-41b5-b0e0-2a194bf82499', '53f9055d-16bb-4635-92f4-b5681b41606d',
  'aa90eb9d-07aa-4c41-a4ad-c96c9858bddc', 'f4972bca-80ce-4c35-9e44-30672eac0e2c', '4482545b-cd2e-4fb1-8423-d273c7f80fca', '8962315b-a2d0-4dc3-b6f4-694af2301a8f',
  '1f36ec6d-df23-493e-8694-d380b2b4b18a', 'e0a22823-9c60-45e3-903e-90f2d109234d', '86b56e89-5f38-40ef-a50c-b4d3f538745d', 'ff306cdf-ed40-4c2e-8ce6-6a8370388f6e',
  '9f712145-074b-4020-a2a2-66623861dd0d', '1bf568f0-3601-4ea2-82b8-8f6da44382e1', 'c2eb8b7c-78e7-47e9-a785-d3b70c2d3969', 'c067fc1e-f281-4239-80a7-078644b37951',
  '622395aa-5cea-4f27-8244-31e12884fb82', 'c4914319-8094-4e25-a9b7-a4b0fad47fff', '00a82851-5ced-4b40-9e03-e7fd44a94c47', 'e55a1937-3318-4297-a129-9cff144d4901',
  'cfc036b4-8c55-4b6c-8f94-d7757d9eb5a9', 'a58f6873-6c64-4414-abc6-2589fddae9ef', '76b366b3-a393-435a-a16d-8061847e01f3', '2404b609-b84b-4544-b362-351b85cd7578',
  '21a17fdb-52ba-4b4e-b526-85ea38ce7ce5', '50e155d3-50e9-4f86-8aec-ac3eae682c45', '0f34dd72-4970-4885-904d-201235b4e03a', 'cdc297e6-e6d4-4555-9ac8-1913735c099e',
  '8151aab1-0586-4561-a114-65c740dba9fa', 'dfaf5c08-5529-4f8b-ac22-d2fcb45272e7', 'daf03032-8f5c-4b18-a767-5b3fff82e22e', '0dc1138d-5c89-40bd-98ee-f8fb32fdfd3c',
  'f1d6dae3-f2e0-4110-bb65-11dcd8baaf2f', '2ebfd91f-bd9b-4dcf-9a8a-22476b3904c9', '83885361-ee56-4d99-8c61-1a9840d7f351', 'b152fcc8-ab68-436f-9d16-b3dc73492c96',
  '27aca836-14de-4df0-8019-b83b7b14628c', '2d9988a4-d2fc-48cd-8147-60733d7a2338', '1585257e-cd23-4a54-8cf6-58f245af9e61', '8ef2e66d-52ac-47ad-96ac-3da25cf783da',
  '2eac45b9-f2f2-4be8-bff4-45b41f8af793', '949b33b3-6d55-48e5-9da5-25ed72b2b302', 'd8bfa202-f61a-4cde-9e8e-d8e7af940928', 'ce0926be-6bf8-4e50-83d0-0389306fd41c',
  '62940dd6-e3bd-4cd2-b27d-33b350ca17aa', '649ea5b3-b409-49c9-8410-7678ba8c4962', '55fc4ff8-e65c-4c09-a4f7-26aba6f7a7cd', '14257d7e-4ccc-447e-9547-f5e1be5a0c74',
  '86bc5f12-ee04-4314-80a7-d8ff92245445', '1c3a06ad-940b-4444-9064-f432580df42e', 'a1134b7b-9235-410f-a0f8-22d8c8e79d93', '4be81d98-73d5-418f-a7ac-099453f51f5b',
  '538719a0-f2b6-4476-b3b8-d0e175a8e9a0', '26a7fb6b-1b7b-4576-9cd2-8f9cb4c1bb57', 'b3bda575-b150-482c-9981-40419ce8442c', '055fa7b5-a1c4-4d44-8739-b79eedad1f32',
  '56d3747a-b93e-4d13-919d-c268909cd9d6', 'cb779b42-f53e-4d57-8ad2-8fc8926d37f4', 'fc543ffc-8fbf-4222-8c6f-134ee49af48f', 'ec2cd2b9-f9c0-496a-a84d-8484e22d0e0a',
  '2c97df72-dceb-4c10-b2b2-f993ebc9daf5', 'e5d6e522-8616-417f-ad91-913bc309a2cb', '253befda-03d3-4427-bfe3-5c9ab8274c98', '2ed90034-9c54-4cf1-805f-adb443740fa1',
  '3c3b9d52-2c9c-45d8-9998-bbc08991a5a4', 'f229e3b7-8012-40a2-b190-4e284276aab9', '6383984f-b1f1-4adf-a659-0cb78604535f', 'cb1b56de-408f-46fe-8b51-128fc2928fee',
  'e463142b-c6c4-4c3d-bf0f-be17eadfbc62', '1a27f1cf-8225-41db-9e77-c33626d78007', 'd406d076-d74f-45ae-bd1a-e7f44b5edacf', '999b96ee-e66e-4071-9f4d-5670ad38d757',
  'a1cb9696-5d85-4003-9fe2-7dbb1bc977d4', 'ec908cfc-bcbf-4710-9c85-6cdff94db880', '27aa8316-dff5-48b4-864e-8f92597fa9c8', '4b24386a-5f5a-42a5-8a69-ca62a32c4cb2',
  'e5de13a2-7d3b-42a0-bbea-4ea6ac6c032f', '3c96f054-d2e2-44d0-8bfb-a56c7d900025', '3ba28ed7-2266-4780-9bce-b8294dbe4fa4', '3ef32ea1-4e50-4e1b-bdf7-a358206a9aac',
  'ed36c001-8cfc-4553-968c-0006666a2270', '366b0084-b02a-4e3b-8f0a-b59c36dfa242', '8c1ffea4-fc9d-4115-ac78-d0b1c2ced13e', '388e4881-f772-45ff-aa72-d3c40f55b243',
  '12283f2d-d81a-4fa7-95d2-4501418d5a7e', 'b61db7aa-6067-4a61-a548-738118378d52', 'df8bca2c-1afa-41ae-9c77-11e0651f9dd4', '3ba7ac9b-5700-4910-ab43-42e5586da641',
  '53117bed-2686-4f37-950f-fe6d8709ad29', '6e7b70a3-9b30-4b3e-99cc-c9e7cdfe7b6a', '9f0d95d2-b3cc-4d98-b5e6-fa308aed756f', '929853fc-1057-49cb-882a-e5b68895c7fd',
  '5fc6db35-aade-4943-b355-ab2e2e7d0ddd', '85272534-68ef-4de0-b5bf-732860c49918', '42c2daf6-ed68-4afb-9125-816314fef0bb', 'dc49d3af-b5a8-4f85-a400-97edfe00e34c',
  '473c36e6-5a55-4df6-a4c1-dc4eb92e0bc2', '64fead1a-fd88-4b38-a856-46b9ad7e39ae', 'ad4be369-6aaa-41df-bad9-a7035ddf74d0', '1ecd1c41-022a-4db6-9518-a557f715ecbf',
  '024c445f-3b7d-49fe-9bfd-0cf8aa886a42', '28597bc0-496e-42d5-9646-41c9038927a2', '4effab9b-1e60-45a8-9fa9-cc5ca6fc709b', '06460fa7-ee5c-4c3e-80e0-1d0546a756ad',
  '59a74caa-1643-4de5-9413-653124c589f6', '144bd7cb-d31d-48f8-af66-b18e51faab00', 'abafeae3-96ea-4015-82d5-7890dd1e9e68', '759d0bad-3767-4b45-9097-bc307dc96912',
  'e4ca4809-58aa-459b-a2e8-68f5ca9c9c53', 'd46dff30-745c-4d5e-938c-cb316eaabfbd', '2283f002-2722-4d90-ab12-42b8ad6ed638', 'd23f1347-af64-4c7a-a7c1-049bf40b1ffb',
  '212cd8b2-8944-4623-a018-ab27ec58b7ee', '34d6e4b2-0555-4698-baf7-f3a69a28c268', '3c16e5cb-c74c-471a-9f40-eb5fc8ea4efa', 'adea95a1-4d4e-49af-bc20-05c435918ac2',
  '44077def-3dd9-4ec9-8308-c708e06b6574', '677953b3-f042-4394-a570-9201edf7f17e', '93f8e023-1ab6-46a5-bfef-c2908f4cabc8', 'cf9ff692-efe0-4b9f-8539-77597adb6b06',
  '03726f11-a0dc-43d8-897e-43d5ec11a57d', 'afba50e4-ce90-4808-babc-1ffb47394ea0', '6559c5e6-e075-4307-a3b5-3f640dc6190e', '2b343c9e-c65b-4c37-80d4-472eaf1be05e',
  'f38cfaaf-7793-44f7-981c-eed4fb2d07b6', '8ead0072-2ad2-4b4d-bc21-caf2b7260c92', 'e045f725-e9e3-4f5f-96e8-5da8daa7ce30', '47fbdd6d-9bea-4634-acbc-ee18eb8f2c1b',
  '5293eae6-7037-4245-b696-c8e562068fcd', '013a5bd5-c9ed-4dec-a255-e24037635875', '2118f4ce-b02e-4706-b312-bae498292026', 'ae949847-6c66-42bd-a7f3-87b80e587fd4',
  '6ee786fb-913e-4ec5-9723-49ac127d5e32', 'a8531095-879c-4297-8228-f420e03da14c', '1e22c0fb-7e31-4aa3-b814-d2c54adaaaad', '5b4a83a1-deb8-4418-998b-22d71c0e746a',
  '00244c7e-bf9a-4dd0-b74e-a00c0e82156b', '3ba794f9-48e9-46f1-8371-f5fc7c6a7225', '591acc6a-e428-4330-8412-a77095ac2708', 'fbcd2a9e-2e7d-47ea-abfd-f6eca79996a6',
  '766c7907-d12a-46da-8ce4-8409f96dc239', '783ed163-e756-4dbe-97bd-bb81de490800', '19ffd7cf-1353-4081-9493-7fa24665d967', '29b83165-8c41-4a76-a853-7231ab27585e',
  '44152434-75e8-4128-b969-0a5cb36e4a29', '48d93153-0a57-4e49-8239-c795403d355d', 'd5335343-9544-4df7-896d-b7c43feb2a67', '43dd4768-84f9-4fbd-b957-503c0297b7fd',
  'eba419f9-c620-4017-8b09-994821a133ad', '29ad5163-e787-4c9b-99cb-f130bf19625d', '3afdbc84-df20-4680-9196-58104a0e1736', '4fcb09ea-80e2-4cd2-918e-baee74f0a2c3',
  '1e958008-073a-4a62-82d9-0350561c6cd9', 'f5400586-79a7-4d08-8926-77a3aef6f0a8', '7abd2627-6c14-4edb-9dea-9e7c3e7dfdb7', '88e7d04d-3bab-45a7-a476-b8d57fbaeea3',
  '81257362-be18-4660-a5fc-aa4f0ace108f', '3e5e501c-ef60-4f46-aac2-cd2aad2d3ba8', 'b4c07c5d-e3d4-40d6-819f-eb1d3ddf3a41', '50727ae0-2b61-4fb2-8d96-7a0138d643bf',
  '87a806d4-339b-40ea-b152-a33e66a5548c', 'c50299ad-6cac-4ad9-ae22-851e94bae378', 'aa444fe7-9462-4a25-87b8-1fa1d90d1ecd', 'd4671fa4-f543-4dc5-a3f0-4a7dff91e9e1',
  '62b3ad8b-777d-4239-9e8f-c3488f4d56c7', '2cc291b1-8500-4a52-bc51-ddbd5ad5d12a', '88865f94-9bd7-480d-94c6-f1edb8b3aa56', '1a4115b6-c5ae-4cc3-8ab2-72adb8f0b735',
  '7f0389da-e229-4831-be92-75da77a35ca0', '31b955cf-28b5-48ee-a84b-b2c42175700b', 'e8ed791b-1f5e-4785-8c6c-023b0e7c242b', '4fb0d84c-2e19-4acf-b7bb-73b1d7268040',
  '1ae482f3-40e1-4dcd-96d6-a87dd73650c6', 'fdfa0958-adf6-4899-b182-59a946b3bc6d', '5df5935c-239e-4412-82d1-17d54f642707', 'c3ff6135-81fa-4972-81a0-d4dd9f26626d',
  'de2bf180-b7af-41f6-8164-2d7c8105549b', '67e2a5c4-8a72-4fe5-af9a-6bdec22ed879', 'bb68d14c-c7b1-448b-844a-d5b08e1b1ca3', '4e088d42-182b-4a5b-901b-0746af37c11a',
  '66d9027f-344b-4681-84b3-26e37ba3487d', 'b0642883-2db3-4f43-9b58-a5b667e3f89f', 'a3eaf89b-1fc4-42ca-9a75-af002e83c809', '00b83c4d-5522-4c84-b976-e938bab2510d',
  'ca6ca5f8-6ec3-4cac-9478-95f4dd86095a', '9def3e22-a96c-4f56-9161-6d8987c3942b', '1619a9fd-3655-424a-a821-d96ae9e7aabe', '044295cb-3efe-4716-baa7-0ae1d87bceac',
  '6ad4730b-7e47-442f-9eca-4f4ead968142', '0927244c-8fb2-46c7-be8f-9cabb17179cc', '8e9886d2-ec09-4c53-a9f9-16567dd481ea', 'bab3aea0-02d1-467f-ade1-913c1f47d655',
  'f89bc423-d353-4a14-9653-150de74b0a47', '3aeac2de-ff0e-41a1-a9ce-08087700b604', 'b00ad84b-e57c-4d50-8ba3-899dbb1db323', '078a765e-3483-448b-8c29-c381408c2e23',
  '39f28be5-ee82-4102-b15b-b880a522cefe', '0085fc4b-a940-4b24-9b54-53a2a9b4b553', '9c22a62e-9b07-425b-a0bc-0bd9c667314f', '2f345ea5-b843-41d7-8050-4d0bea893978',
  'd8dd6543-2466-4f44-bcc5-d4a9e2de558e', '12c71b08-82e7-4010-a7f6-6d38ad79eff9', 'e58d42c4-03bb-48a6-b074-cd11d482d62d', '0c77ef24-e5c0-4d75-9f0e-59e7b9bb140d',
  '548d6977-1c99-474c-a862-235f77acf736', 'fa634316-8b7e-4f87-be6b-6939087f9543', '63baa42b-e754-46d0-8cdf-82a3ac87b355', '9947310a-737d-4e84-83cb-f652451f9992',
  '2676809e-e1fd-47ae-ad7b-28e34f2659b9', '06567b9b-2268-47d7-8b48-af37abb655a3', '126877e6-8c55-4ded-bd11-87ae48b0e325', '317750f0-067f-4f1a-9d73-73cd8cadce92',
  'ce2e8777-054a-4eb3-b2fb-ace6288678fa', '7783ce0e-88ce-4393-8930-69ae17e09781', 'e03c35df-1233-4982-add9-fa8ba349d65c', 'b85fee3b-ef05-493a-b357-d6cc5b89bbfc',
  'adb4fa40-ba03-49e3-a603-7e47bac96f01', '181b5daf-920c-495f-8d72-46e5b9637341', '48650368-1e70-4f94-bb94-e3d501c5c472', 'e98aa330-a016-49cf-9b3a-88cfa46fb273',
  '408c6798-fd9d-4f36-8fe8-3e38e8d85c32', '0987b339-ed09-4b8e-a13c-1b185c4a2b0a', '5b996e38-d6c3-45d4-b74d-a81bbb016a85', '8e077bad-811a-4e25-a994-609846dd429e',
  '1cadb526-93bc-4d68-96e0-033b8b487bc6', 'dd26bbc2-c9d4-404a-ae87-095f334b73ef', '147357a8-1c64-46c9-b9fb-4c9f6dada787', '3ad0fb2a-0fcf-414d-a8d8-2281a19f221e',
  'c286b144-e61f-43d0-bbe8-623bce5ae8e1', 'a28d43e4-bdd0-4f2a-a2aa-2302cee0a518', 'f6e90714-66f3-4c1a-a555-d04c9cda6652', '8f95eb54-a197-46e4-b1ed-c656f6e86ddd',
  '8e66350d-3177-4fee-bd6c-66fd30b2a9e7', 'ba8acb43-8169-40fc-a307-472f765cafcf', '787747fa-ab21-41a0-8246-d8e26f84b078', '09844192-3321-4a86-b9e6-1af509a74f7c',
  '6521e757-5fc5-41e8-8784-7564096883fd', 'a5f3019a-7ae9-49c4-aca9-fc4e650370f1', 'ce79690b-c7fe-4483-a867-b7066272264d', '503eae94-4015-4c7d-b627-6398d0dd862d',
  '323077b5-90b7-4578-9c23-6149e009a081', '4201883c-da0b-4b86-b808-e98d1da4f3b8', '3ddfd3b9-657d-44d9-9834-1682587f58d0', '2af671f9-84ef-4377-86fa-2260d94fc65a',
  '44a8ef47-bbb0-4264-835d-1ce88ea58985', 'f157949a-e90e-4d4e-ad37-da20585599e1', '29d6d467-49aa-4096-b8b2-605ffbd8106b', 'cf216ef1-1d7f-407a-87d4-3abf229fdda4',
  'dc39ab0d-4396-4da7-8e34-21908cf4309b', 'c5dcc74a-55b7-4456-8c53-dff200d72788', 'eec5a5ba-1603-40c0-b1d5-a4f3dcb17338', '30f8ffab-4177-4309-89d8-0408b484d2c3',
  '0fc4efdb-2566-4c2e-968a-f457f22ca2e7', 'd9f38972-3089-4a2e-9f19-769cae971d19', '0826a86a-4564-41a0-a712-945796952cc0', 'ea887f6e-805e-4791-87de-3cec73c9a01c',
  'e57f607a-9ada-4ed0-9c35-7b3b4f15690b', '4e1bc3bc-d642-4221-a8b6-f14523ff40dd', 'df8d08b5-1c3d-4757-8d9d-f9ef3b480651', '63104e51-39e2-4453-8c56-6e06266a2923',
  'fde3c457-1ab1-4ebe-a7ef-7b01fe0f0803', 'b79cbc14-b90b-4ad4-8066-56b3294e6d6b', 'a2de666f-bb23-4ed1-8780-7780d19b34cc', 'f1f88b50-5808-4149-a526-78dea1c94602',
  '6dda162c-a953-467f-920c-6ddf9907d0bf', '5df678d4-c160-4077-b02b-c50ec19542ee', 'c1501be1-45e1-4600-b227-dbe0f0a49e39', '68807e2f-1573-43ba-bc69-c64a0083818e',
  'edc7700c-eaa6-4109-b9d4-80cc9e8e1b07', '30d326d8-37b1-4465-9623-f105374d6410', '7bda033c-6afa-4c0f-8cbe-860e63a42a27', 'f15d71e5-ac85-433e-ba3f-8cf53669c583',
  '7f456476-3b6a-47cf-8bf0-37a1084f0660', 'afcf51da-3355-43a3-a3c2-9dbbcd5c98c8', 'd02b6d43-04f9-4c52-9371-73cd141a37cd', '580d3549-97b6-4655-9d16-514700264bc2',
  'f70f39f7-a6ab-402c-9913-9dd91cd942a7', '0c89259f-4341-4eeb-bfaf-64c27711a9fd', '573c2be7-066e-4673-95fe-e86d1564cc94', 'c747336a-121b-4362-893a-c33485ac3645',
  '651fa735-7f97-4ca2-bef6-e0d86979c8ea', '66351aa4-198c-436a-81db-4531f1b68726', '3acd63cc-fe2a-4c1b-a346-7d85098b7844', 'a781fad0-a7b3-4466-b935-97247ed02d40',
  'e1c187ec-dff7-4ce4-98ba-9d66323a9bec', '93945813-4aef-41c2-a6a9-b5415041d961', '8e91fd76-720e-4c79-bdbf-c563388e8a6b', 'f35f6b98-f239-4b98-acb7-bb68b3a56af4',
  '2303ab5e-d2fe-4833-9980-e02c2702c863', 'f3977a4a-8b67-4b12-bdc5-5a58373654b1', 'cf096c0d-dbb1-4fdd-a421-4e70f8c422be', 'e3f5dd57-8ec6-436b-a949-0eceb32929ab',
  '7b6a13bd-caa3-462d-b418-4dbccd876a71', 'ece5d1fe-2c22-4ff3-b067-648a2b7dd54c', '0a4dba96-e94b-45e9-b81d-f537cf897deb', '0091a6ad-70bb-44ff-b10b-0e7c5e58f438',
  '5005d817-cfc6-4342-ba30-bee1e58201a4', '857153a1-f249-454f-be85-b4a54d056214', '0d7aee36-2aef-443e-bb45-92ecf2f493fa', 'ab681e80-d1c3-448c-b6ba-bc7b1e121cfb',
  '9f3a9c50-b3f8-4adb-b8fe-7efd526ed19d', '1ecf67d8-3dde-4375-acec-a804f4657bcc', 'cf356b9b-f7ad-4740-9b6e-1d1e3880a17c', '9e51e258-2501-45e9-8e07-0dc28c2d08a3',
  'e7820342-a415-49b0-802d-998c2e0e5c80', 'a2aefccd-3e1e-4776-a812-05febf9104aa', 'cf6f1d84-3ce2-4558-8a5d-502aa1f6e63d', 'ed734a22-22ab-4d68-8327-866213961a7a',
  'de5251db-afa7-4967-8ab0-f731a638d861', '781bbb4f-3495-4aaa-839f-648f812d8cbd', '682a66df-1dc0-4d24-8fe4-56ecc8984658', 'c1988a83-a028-4e6d-a2ec-670aa36c0cac',
  'c4265ae2-637b-4607-8d57-550023710b06', '2e96dd77-db06-49d5-849d-b1298a0e1e46', '4f5572ce-aec7-4a62-b148-0e1903d6c70e', '693c81ca-79b2-4356-989e-7dbd935ae869',
  'b3e433ac-44fa-4a16-be57-9cb6d34776f1', '1cbe3896-afd4-4320-9bb5-5f3d8b519805', 'c89c44ef-00bb-47ce-8ac0-d5ee314a263a', 'b53a9757-417f-4804-8321-b188f6b18926',
  '0dc27df3-076d-4f67-bc2a-110014f99965', '8a2e149c-ccc2-4b38-9bf6-f19228e913d0', 'fc2eb860-e0db-45af-8252-619f2b826f2c', '619090f6-9623-4722-afc9-247f06f1eda2',
  '3b493940-694c-44db-87c9-b3e88186b6e1', '3e477d47-a13c-4967-8ccb-02be7a1ccad5', 'dde9c9de-fab5-45d7-a807-2ed3c8eac97f', '909013b1-b1ee-40bc-81df-e6d2efe18ceb',
  'f0f00cae-db68-405a-8007-b888b9b2ca38', 'af241c2c-2365-41fd-9b87-f6cdfc2c50e4', '7c9b4c41-e934-472a-9a51-0abfb2388afd', '9b3e0ca7-3a2e-4a21-9a1b-b269e8c66050',
  '852efbc2-d47d-4d90-a851-4117da5e7a6c', 'bea32936-94aa-4915-b8a8-b9a7eb6e0855', '6c4a37da-d6b7-4ddc-92e8-5169c70e0d34', '3a8506ab-094c-4d3d-bb2a-22ad0d04355c',
  '9b620536-848f-4588-b39d-4f0ff775042f', 'af1b3596-4770-4539-9709-48db9466d9c8', 'f5c5731e-7fd8-4441-9608-103b95703cfa', '9db6af8a-be8c-4e61-a545-f6ca10c2bb35',
  '69a24e02-6430-4624-b49d-0630477f89b9', '7d858f7f-5148-462f-aa02-fd671b71ea33', '22dd9b8c-466c-4ffb-82d0-c9103bbfbc05', '861a128a-a7e9-4333-ae9f-6d3c27ebfe1f',
  '030396d6-340b-4da1-8c95-1c73aba2d4b8', 'e0ff0a9d-99da-4f95-91ef-b63300cca59e', '2e1de87f-990f-4698-ba92-c8dd0acc8e68', '8f2284fb-4f6a-4b02-868e-d0b888e12c0b',
  '2c07dd8e-9012-4713-945a-d9ee2cd06850', 'baac692f-bf2b-4424-9e20-1e9e5867edaa', 'ca5e18b2-b90f-4b37-9fbd-f3eb620cf622', '798f1ca5-fd93-4145-b977-dcabc4ec29b0',
  'f588679f-eeb0-46af-a993-8b13434b5f57', '0f1a78ab-681e-4077-a562-3a6bc3de44f7', 'a536103f-64a8-41ae-918d-8d25cd039cb1', '4db02d9d-aaa3-471a-9ae4-416827ec4685',
  'f5585ff5-cc2e-4c17-8eea-6b0424c29a3a', 'ccd0303b-4641-4e25-8154-1d78bb6d8e15', '6abf2f95-1095-482b-95e5-d6b1c7d28efc', 'ad770435-beed-4fbf-9209-c00e0c9c01a7',
  'de97d07c-4b4c-4095-ab1d-c82fec24b949', '7dbf503c-b67b-4f95-8edc-c516c512f24c', 'ac3fdfde-0d6d-42a9-b0cc-e71f39af1ef6', '04467191-4e6f-46cf-866e-14e2f6b0c450',
  '0fc9009e-bbad-45f3-8a64-ee25d9eb58f5', '0e894a51-1f6a-4340-abf4-3e4c4bd53130', 'ea7566c8-9be3-449e-bfd9-5eae4d3bff15', '69597157-bfb0-4761-811c-611aa6f38cb1',
  'ed41bc60-9f0f-40a3-bfdf-5bc0985cc7bb', 'e5cb0efe-df64-4906-9f46-131159357616', '4192eb39-10fb-4632-a768-18e2bb3eda2a', 'c6151d38-b1a3-484e-ae29-265d0c4e0b25',
  '7a2a9aec-53a9-4ecc-98ce-54b8187fa577', '45df73be-0bdd-432a-bd04-179b35a41fc9', '6507c14f-166c-4851-a8f0-0f398bdebe96', '26f0a412-65cb-41a6-959c-62cd31cd8591',
  'bf180f26-df53-43cd-81fe-5398d4c80611', '91048b38-24fa-41a4-938b-35fbedc5296c', '6b9ae2bc-d346-4296-8cc2-997dfda6506d', 'b677188e-1152-4ee2-a4b7-aacd2e5d5ab3',
  '879d4316-f257-42e5-82d1-c316910b3c0d', '1e99ac5c-f72b-411e-9ea3-fb59ac7ddc8a', 'fca0486b-ddd2-4cb5-a7e3-791d27ba9892', 'eae3703d-d5f3-4902-a350-c2cf7ee4235b',
  '473dc9b6-f0c0-4a2d-9383-169d6bf6a9e6', 'ab8d2b79-8b1d-4d4b-abfe-b016abb7147b', '64c491df-33bf-4652-9b6b-23acf44ad525', '9d2d4d31-5b4d-46d3-ada9-057ae9414ce3',
  '17c13ac5-a059-4a45-b75e-dac1ce28dd01', '46acfbba-a095-4d4f-b472-7998ebb376bb', 'd74f38d8-42a0-4e99-862c-817533e3e59c', 'cc8a6db2-1a1f-4a9f-90e6-be117bfdd452',
  '78f43448-8701-4aa6-b344-a27afeeda380', '03921430-3581-4d8a-84ec-409d54fb1745', '6523deb0-c181-44da-8ebb-ed5c12f7a804', '69cc83e6-9bdc-4f0a-a78c-d68870cb4575',
  'd21348c3-4360-4231-a626-8dfa5c6f61bb', 'dac439f8-4828-4509-b141-9d699224ec13', '643699bd-cdf8-47e6-9782-e3580d854f79', '8b47cdf9-3421-4400-b3b4-d815404c36ea',
  '6c61ca3b-83c9-4dc1-a788-def9d161c3f3', 'f86abca9-42b7-489b-a641-2a404a1fb0e0', 'e6d01d8b-82c3-4baf-973a-9335ef278d29', 'c96901d2-a363-4171-9886-7113ece54063',
  '4bc39eb7-6bb3-4f40-be21-39422dc7785e', '011f47a1-abe0-4dcb-992f-cee92e6bbaa7', '2c9aeb52-2637-48e9-82b7-e4c2312e70e6', 'e6a7613f-3a81-435e-aee7-ea8b2611d9fb',
  'bd0413f4-f62b-4cf5-adc7-aeed510d351e', 'e7e47471-c8ed-4a96-aab6-67b054c43840', '6afda85f-b4d1-4cee-9ab2-f9e3a07ffa08', '022ce457-f974-40a2-8d9a-e1474b22a582',
  '6abdc20a-1e36-4741-b4b9-5bdb118c7f46', '84f7eef9-b4cd-4fe2-8357-d4ad4aa03ba0', 'cb05d49a-91ed-4d52-a0e9-955594624301', '56b950ab-4a2e-4703-90c7-8beb0a3a7258',
  '6da70638-7d87-4f23-9d9a-977695622984', 'b46d0ad8-e0d3-43ed-a654-8f63b4a2f229', '2e1ff979-76af-44cf-b078-35ecb09ebd5c', '4a629827-5538-40ff-979c-823750b038de',
  '80c5590e-f173-44b4-a451-0045e558d9cd', '47057fb2-e1d9-44d4-baf7-581ea8ebbbf8', '3f5dc52c-8c26-4093-8077-ae2184391040', '1d535e4f-f0a3-4e79-82fa-e0c6464336fe',
  '3453c313-7860-4f0f-a75d-3fc0fba4d8fb', '477e116a-61ff-48bc-a0a9-a8a0848afe4a', '27b6f45f-0481-4331-8f61-18e95e0f570f', '10bef33b-197a-47d3-9221-edf484ef1362',
  'd8672500-b32b-4b33-b730-cc09f5ba123d', '01a73144-e5c4-495d-825d-69731d845811', '5c8559d9-e55f-4158-b1cc-ae90f02b6151', '50c08467-35f7-4399-b931-2b2ef0de2d7e',
  'eb32eef7-fbab-4bb0-b0fb-23a36284d17a', '1b089b20-c3f8-49ee-8f0a-a95542af7fd4', 'e9df7033-f7e7-4f60-8d17-cd9c64e7d164', '716a759d-b88b-4aa8-b3d1-ac3389bfe52f',
  '55d7284a-8553-46d7-9d8f-333c946aded9', '6dddbd88-04df-4798-bcc3-c26407c74fbf', '877604d3-961b-46ee-b70a-825941a0f792', '71d06132-f612-4f5a-a4b4-9197d8f4604a',
  '37e7cfd9-9272-4870-90b6-2746b8d46e6e', 'c8397fb2-9991-4024-bb17-c71d8cd2a0fa', '66645ad2-f8d2-46e0-b113-e1480c62cfab', '2f52c067-6036-454e-afe7-9176bf27b7cf',
  '06e4db20-a4d1-41f4-91ad-34f00122a35d', 'fbece200-ecbd-46cf-87f6-402566346e8a', '58501411-c03e-4f5d-bb23-4a6d97f344b2', '6f5fff31-750e-4cbd-bac7-8f863e0aaa5f',
  '617b96a6-a8fa-42de-9597-6e052b046ccd', '954cfd94-d99c-488c-9df1-148d90a21ed6', 'afc4621e-30f6-4db4-89c6-1cc81ca8b366', '7b7e3d70-c96c-42b9-b046-90127ae49786',
  'df8eebd9-1d5a-4b87-9d25-b990107e6a73', '1c3c7997-9ea6-431f-b9c2-de2b80cbe759', 'de5e4dce-2e56-4458-b3bb-c7b083041b27', '623a804c-2feb-4232-9a06-b8de1d4911fb',
  '9f160bbc-43ce-44ca-9733-93e5e430dcfd', '33f0fd35-3c22-4d80-b349-5b686b98f5b5', 'f351cbe4-5028-48ed-acec-6805eb06c76e', 'b88d6175-02cd-493f-982a-0cf2bb5c2f33',
  '4eaa8b24-1dac-4425-b59f-6386f79eb990', '577be8f0-3b48-4d1f-bddd-a36d70837388', '8ab22f2b-9eee-45b9-8abd-2234a29f6872', 'da04d3f1-cc76-4d43-8c1c-7a4fb653b6c9',
  'b0cda58d-c121-4ed0-a926-d0effa0a2666', '4f6b46cb-a978-49c6-a823-31c2cb0bad85', '555ec0d2-022e-4892-bb78-98e64688a70b', '7993b881-cf9b-4431-b663-c61b4578f3ec',
  '53d02aa2-7f86-42dd-ba35-03b9d726287e', '63b6d291-6fef-4cc4-b7e8-f5d33a9be304', '403398c4-04e1-4cbf-8359-94322d55b6c0', 'f96e87aa-0582-41d1-802b-9fde6d37e12a',
  '8201609a-d979-4045-bcf7-24193251546e', '61224cd4-c8eb-4062-91b0-d8ea490273fd', '1c83fab8-8956-4a31-9748-ab7f9926d262', '1e8ff313-3b71-45cc-8185-8779dd74c8c0',
  '78991929-0c67-4380-9335-d8e72db27d85', '45e9474f-12a9-4ea5-b7a4-401ae5fdbb80', 'a104fa6b-41f1-41aa-b162-cae246ce81a2', '564c954b-5c53-4892-b7a2-84f50b36e6c0',
  '44699919-616b-48d4-bc89-cb0a3698c35c', 'b887ee05-8143-4e2f-981a-19f3fd0d9067', 'd56830ee-235b-4019-a44c-688e12109116', '267231d2-c464-4bad-b361-4dc872b459a9',
  '7e203ef9-4829-4832-a2c4-c7a7d6b3b2b8', 'cea20bbf-928b-4bd0-aa7c-cde7c9561fd7', '9c2915ab-73de-4ccd-951d-0438c95b08f9', 'dd40a1eb-b1ec-456b-8ed5-a18deb015837',
  '17f0474f-5a7d-40ab-af53-4c7e1acbfec9', '5a0d88a4-c4bb-4f7c-b0b4-cb04b01084ff', 'aaf40597-596e-416a-a860-6880362c3040', '359ec153-93c0-47cf-87b4-16aff4b12cae',
  '29de8c66-26d6-4091-9373-fc5be8498da5', 'f517f8a4-61ea-459f-a26c-335c43048fa1', '05d75039-c181-412e-8bdb-75b6d2829bc7', '367102d9-ebd6-4d3c-81a3-abc20f4347c4',
  'a493d7db-5c70-444b-99c8-c1eceea68d1c', '7aec8ff7-1c98-4fb3-b32a-54471972c16a'
);

delete from simulations s
using simulations_removed r
where r.id = s.id and r.removed_reason = 'sandbox build (proven)';

-- ── STEP 2 · leaderboard_user_stats ─────────────────────────────────────────
-- If this says MATERIALIZED VIEW, run: refresh materialized view leaderboard_user_stats;
-- (a VIEW updates by itself; a TABLE is filled by your own job: re-run it)
select table_name, table_type from information_schema.tables where table_name = 'leaderboard_user_stats'
union all
select matviewname, 'MATERIALIZED VIEW' from pg_matviews where matviewname = 'leaderboard_user_stats';

-- ── STEP 3 · Undo (only if needed) ──────────────────────────────────────────
-- do $$
-- declare cols text;
-- begin
--   select string_agg(quote_ident(column_name), ', ' order by ordinal_position) into cols
--   from information_schema.columns where table_schema = 'public' and table_name = 'simulations';
--   execute format('insert into simulations (%s) select %s from simulations_removed where removed_reason = %L', cols, cols, 'sandbox build (proven)');
-- end $$;
