function mySettings(props) {
  return (
    <Page>
        <TextInput
          label="Api endpoint (if blank, defaults to local xDrip endpoint)"
          settingsKey="endpoint"
        />
        <TextInput
        label="API SECRET"
        settingsKey="apiSecret"
        />
        <Toggle
          settingsKey="usemgdl"
          label={`Units: ${props.settingsStorage.getItem('usemgdl')== 'true' ? 'mgdl' : 'mmol'}`}
        />
        <TextInput
          label="High threshold"
          settingsKey="highThreshold"
        />
        <TextInput
        label="Low threshold"
        settingsKey="lowThreshold"
        />
      <TextImageRow
        label="Fitbit NS watchface"
        sublabel="@Rytiggy / @nivz / @sulkaharo"
        icon="https://image.ibb.co/gbWF2H/twerp_bowtie_64.png"
      />
    </Page>
  );
}

registerSettingsPage(mySettings);